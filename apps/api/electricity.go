package main

import (
	"context"
	"errors"
	"math"
	"net/http"
	"slices"
	"sync"
	"time"

	"civicpulse/api/sources"
)

// ---------- Catálogo de indicadores de ESIOS (sistema peninsular) ----------

// tech es una fuente que aporta energía a la red. Los textos (de dónde sale, por qué cuesta lo que cuesta)
// viven en la web (src/lib/energy.ts); aquí solo el indicador y si es renovable.
type tech struct {
	ID        string
	Indicator int
	Renewable bool
}

// Generación en tiempo real (MW, cada 5 min). Bombeo y baterías entregan energía almacenada: no cuentan como
// renovables. Las importaciones se añaden aparte (saldo positivo de intercambios).
var techs = []tech{
	{"solar-pv", 1295, true},
	{"wind", 551, true},
	{"hydro", 2080, true},
	{"solar-thermal", 1294, true},
	{"renewable-thermal", 1296, true},
	{"nuclear", 549, false},
	{"combined-cycle", 550, false},
	{"cogeneration", 1297, false},
	{"coal", 547, false},
	{"fuel-gas", 548, false},
	{"pumped-hydro", 2079, false},
	{"batteries", 2167, false},
}

const (
	indDemand          = 1293 // demanda real peninsular, MW
	indDemandForecast  = 544  // demanda prevista, MW
	indCO2             = 10355
	indExchanges       = 553  // saldo de intercambios internacionales: + importa, − exporta
	indBaleares        = 554  // enlace con Baleares: − envía
	indPumping         = 2078 // consumo de bombeo (negativo)
	indBatteriesCharge = 2166 // carga de baterías (negativo)
	indPVPC            = 1001 // PVPC 2.0TD, €/MWh, por hora
	indPeriod          = 1002 // periodo tarifario 2.0TD: 1 punta, 2 llano, 3 valle
	indMarket          = 600  // mercado diario (OMIE), €/MWh, cada 15 min
)

var periodNames = map[int]string{1: "punta", 2: "llano", 3: "valle"}

// ---------- Ahora mismo ----------

type mixItem struct {
	ID        string  `json:"id"`
	MW        int     `json:"mw"`
	Share     float64 `json:"share"` // % de la generación total
	Renewable bool    `json:"renewable"`
}

type flows struct {
	ExportsMW         int `json:"exportsMw"`
	PumpingMW         int `json:"pumpingMw"`
	BatteriesChargeMW int `json:"batteriesChargeMw"`
	BalearesMW        int `json:"balearesMw"`
}

type electricityNow struct {
	At             time.Time `json:"at"`
	DemandMW       int       `json:"demandMw"`
	ForecastMW     *int      `json:"forecastMw"`
	GenerationMW   int       `json:"generationMw"`
	RenewableShare float64   `json:"renewableShare"`
	CO2GPerKWh     int       `json:"co2GramsPerKwh"`
	Mix            []mixItem `json:"mix"`
	Flows          flows     `json:"flows"`
}

// buildNow toma el último instante con demanda publicada y reparte la generación de ese instante.
func buildNow(series map[int][]sources.ESIOSValue) (electricityNow, bool) {
	demand := series[indDemand]
	if len(demand) == 0 {
		return electricityNow{}, false
	}

	last := demand[len(demand)-1]
	at := last.Time
	value := func(id int) float64 { return valueAt(series[id], at) }

	out := electricityNow{At: at, DemandMW: int(math.Round(last.Value)), Mix: []mixItem{}}

	if v, ok := lookup(series[indDemandForecast], at); ok {
		mw := int(math.Round(v))
		out.ForecastMW = &mw
	}

	items := make([]mixItem, 0, len(techs)+1)
	for _, t := range techs {
		items = append(items, mixItem{ID: t.ID, MW: int(math.Round(max(value(t.Indicator), 0))), Renewable: t.Renewable})
	}

	exchanges := value(indExchanges)
	items = append(items, mixItem{ID: "imports", MW: int(math.Round(max(exchanges, 0)))})

	total, renewable := 0, 0
	for _, it := range items {
		total += it.MW
		if it.Renewable {
			renewable += it.MW
		}
	}

	for _, it := range items {
		if it.MW <= 0 {
			continue
		}

		it.Share = pct(float64(it.MW), float64(total))
		out.Mix = append(out.Mix, it)
	}

	slices.SortFunc(out.Mix, func(a, b mixItem) int { return b.MW - a.MW })

	out.GenerationMW = total
	out.RenewableShare = pct(float64(renewable), float64(total))
	// tCO2/MWh → g/kWh
	out.CO2GPerKWh = int(math.Round(value(indCO2) * 1000))
	out.Flows = flows{
		ExportsMW:         int(math.Round(max(-exchanges, 0))),
		PumpingMW:         int(math.Round(math.Abs(value(indPumping)))),
		BatteriesChargeMW: int(math.Round(math.Abs(value(indBatteriesCharge)))),
		BalearesMW:        int(math.Round(math.Abs(value(indBaleares)))),
	}

	return out, true
}

func (a *api) handleElectricityNow(w http.ResponseWriter, r *http.Request) {
	if a.src.ESIOSToken == "" {
		writeProblem(w, r, http.StatusServiceUnavailable, "esios-not-configured", "Falta ESIOS_TOKEN para los datos en tiempo real.")

		return
	}

	now, err := a.elecNow.get(r.Context(), "now", func(ctx context.Context) (electricityNow, error) {
		end := time.Now().In(madridTZ)

		ids := []int{indDemand, indDemandForecast, indCO2, indExchanges, indBaleares, indPumping, indBatteriesCharge}
		for _, t := range techs {
			ids = append(ids, t.Indicator)
		}

		// La última hora basta: el dato más reciente llega con unos 8 minutos de retraso.
		series, err := a.esiosSeries(ctx, ids, sources.GeoPeninsula, end.Add(-time.Hour), end, false)
		if err != nil {
			return electricityNow{}, err
		}

		out, ok := buildNow(series)
		if !ok {
			return electricityNow{}, errors.New("no recent demand values")
		}

		return out, nil
	})
	if err != nil {
		a.logger.WarnContext(r.Context(), "esios now failed", "err", err)
		writeProblem(w, r, http.StatusBadGateway, "electricity-unavailable", "Red Eléctrica no responde ahora mismo.")

		return
	}

	writeJSON(w, http.StatusOK, now)
}

// ---------- Hoy, por horas ----------

type generationMix struct {
	Hydro   int `json:"hydro"`
	Nuclear int `json:"nuclear"`
	Gas     int `json:"gas"`
	Wind    int `json:"wind"`
	Solar   int `json:"solar"`
	Other   int `json:"other"`
	Exports int `json:"exports"`
	Pumping int `json:"pumping"`
}

type hourInfo struct {
	Start time.Time `json:"start"`
	// PVPC 2.0TD en €/kWh: lo que paga un consumidor con tarifa regulada.
	Price float64 `json:"price"`
	// Parte del precio que es energía del mercado diario (€/kWh); el resto son peajes, cargos y otros costes.
	Market    *float64 `json:"market"`
	Regulated *float64 `json:"regulated"`
	Period    *string  `json:"period"`

	// Solo para horas ya transcurridas (generación real).
	DemandMW       *int           `json:"demandMw"`
	RenewableShare *float64       `json:"renewableShare"`
	SolarShare     *float64       `json:"solarShare"`
	WindShare      *float64       `json:"windShare"`
	Generation     *generationMix `json:"generation"`
}

type cheapestRange struct {
	Hours         int       `json:"hours"`
	Start         time.Time `json:"start"`
	Average       float64   `json:"average"`
	SavingPercent int       `json:"savingPercent"`
}

type marketHour struct {
	Start  time.Time `json:"start"`
	Market float64   `json:"market"`
}

type electricityToday struct {
	Date     string          `json:"date"`
	Source   string          `json:"source"` // "esios" o "redata" (sin token: solo precios)
	Average  float64         `json:"average"`
	Hours    []hourInfo      `json:"hours"`
	Cheapest []cheapestRange `json:"cheapest"`
	// Hora más barata y más cara del día: el «por qué» se explica comparándolas.
	Extremes *struct {
		Cheapest hourInfo `json:"cheapest"`
		Priciest hourInfo `json:"priciest"`
	} `json:"extremes"`
	// Mercado diario de mañana por horas; vacío hasta que OMIE lo publica (~13:00).
	TomorrowMarket []marketHour `json:"tomorrowMarket"`
}

// summarizeDay calcula la media, la franja más barata de 1, 2 y 3 horas seguidas y los extremos.
func summarizeDay(hours []hourInfo, source string) electricityToday {
	out := electricityToday{Source: source, Hours: hours, Cheapest: []cheapestRange{}, TomorrowMarket: []marketHour{}}
	if len(hours) == 0 {
		return out
	}

	out.Date = hours[0].Start.In(madridTZ).Format(time.DateOnly)

	sum := 0.0
	minI, maxI := 0, 0

	for i, h := range hours {
		sum += h.Price
		if h.Price < hours[minI].Price {
			minI = i
		}

		if h.Price > hours[maxI].Price {
			maxI = i
		}
	}

	avg := sum / float64(len(hours))
	out.Average = round4(avg)
	out.Extremes = &struct {
		Cheapest hourInfo `json:"cheapest"`
		Priciest hourInfo `json:"priciest"`
	}{hours[minI], hours[maxI]}

	for _, n := range []int{1, 2, 3} {
		best, bestAvg := -1, math.Inf(1)

		for i := 0; i+n <= len(hours); i++ {
			s := 0.0
			for _, h := range hours[i : i+n] {
				s += h.Price
			}

			if s/float64(n) < bestAvg {
				best, bestAvg = i, s/float64(n)
			}
		}

		if best < 0 {
			continue
		}

		out.Cheapest = append(out.Cheapest, cheapestRange{
			Hours:         n,
			Start:         hours[best].Start,
			Average:       round4(bestAvg),
			SavingPercent: int(math.Round((avg - bestAvg) / avg * 100)),
		})
	}

	return out
}

// buildHours cruza, hora a hora, el PVPC con su periodo, el mercado diario y la generación real.
// gen son las series horarias de cada tecnología (por indicador).
func buildHours(pvpc, period, market, demand []sources.ESIOSValue, gen map[int][]sources.ESIOSValue) []hourInfo {
	hours := make([]hourInfo, 0, len(pvpc))

	for _, p := range pvpc {
		h := hourInfo{Start: p.Time, Price: round4(p.Value / 1000)}

		if m, ok := lookup(market, p.Time); ok {
			mk := round4(m / 1000)
			rg := round4(h.Price - mk)
			h.Market, h.Regulated = &mk, &rg
		}

		if v, ok := lookup(period, p.Time); ok {
			if name, known := periodNames[int(v)]; known {
				h.Period = &name
			}
		}

		if v, ok := lookup(demand, p.Time); ok {
			mw := int(math.Round(v))
			h.DemandMW = &mw
		}

		total, renewable, solar, wind := 0.0, 0.0, 0.0, 0.0
		hydro, nuclear, gas, other := 0.0, 0.0, 0.0, 0.0
		complete := true

		for _, t := range techs {
			v, ok := lookup(gen[t.Indicator], p.Time)
			if !ok {
				complete = false

				break
			}

			v = max(v, 0)
			total += v

			if t.Renewable {
				renewable += v
			}

			switch t.ID {
			case "solar-pv", "solar-thermal":
				solar += v
			case "wind":
				wind += v
			case "hydro":
				hydro += v
			case "nuclear":
				nuclear += v
			case "combined-cycle", "cogeneration", "fuel-gas":
				gas += v
			default:
				other += v
			}
		}

		if complete && total > 0 {
			exports := 0.0
			if exch, ok := lookup(gen[indExchanges], p.Time); ok {
				if exch > 0 {
					total += exch
					other += exch
				} else {
					exports = -exch
				}
			}

			pumping := 0.0
			if pump, ok := lookup(gen[indPumping], p.Time); ok {
				pumping += math.Abs(pump)
			}
			if batt, ok := lookup(gen[indBatteriesCharge], p.Time); ok {
				pumping += math.Abs(batt)
			}

			r, s, wd := pct(renewable, total), pct(solar, total), pct(wind, total)
			h.RenewableShare, h.SolarShare, h.WindShare = &r, &s, &wd
			h.Generation = &generationMix{
				Hydro:   int(math.Round(hydro)),
				Nuclear: int(math.Round(nuclear)),
				Gas:     int(math.Round(gas)),
				Wind:    int(math.Round(wind)),
				Solar:   int(math.Round(solar)),
				Other:   int(math.Round(other)),
				Exports: int(math.Round(exports)),
				Pumping: int(math.Round(pumping)),
			}
		}

		hours = append(hours, h)
	}

	return hours
}

func (a *api) handleElectricityToday(w http.ResponseWriter, r *http.Request) {
	now := time.Now().In(madridTZ)
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, madridTZ)

	load := a.loadTodayREData
	if a.src.ESIOSToken != "" {
		load = a.loadTodayESIOS
	}

	out, err := a.elecToday.get(r.Context(), day.Format(time.DateOnly), func(ctx context.Context) (electricityToday, error) {
		return load(ctx, day, now)
	})
	if err != nil || len(out.Hours) == 0 {
		a.logger.WarnContext(r.Context(), "electricity today failed", "err", err)
		writeProblem(w, r, http.StatusBadGateway, "electricity-unavailable", "Red Eléctrica no responde ahora mismo.")

		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (a *api) loadTodayESIOS(ctx context.Context, day, now time.Time) (electricityToday, error) {
	endOfDay := day.Add(24*time.Hour - time.Second)

	genIDs := []int{indDemand, indExchanges, indPumping, indBatteriesCharge}
	for _, t := range techs {
		genIDs = append(genIDs, t.Indicator)
	}

	var (
		wg                                   sync.WaitGroup
		gen, prices, market                  map[int][]sources.ESIOSValue
		errGen, errPrices, errMarket, errTom error
		tomorrow                             map[int][]sources.ESIOSValue
	)

	wg.Go(func() { gen, errGen = a.esiosSeries(ctx, genIDs, sources.GeoPeninsula, day, now, true) })
	wg.Go(func() {
		prices, errPrices = a.esiosSeries(ctx, []int{indPVPC, indPeriod}, sources.GeoPeninsula, day, endOfDay, false)
	})
	wg.Go(func() {
		market, errMarket = a.esiosSeries(ctx, []int{indMarket}, sources.GeoSpain, day, endOfDay, true)
	})
	wg.Go(func() {
		tomorrow, errTom = a.esiosSeries(ctx, []int{indMarket}, sources.GeoSpain, day.Add(24*time.Hour), endOfDay.Add(24*time.Hour), true)
	})
	wg.Wait()

	// Sin precios no hay respuesta; sin generación o mercado, se devuelve lo que haya.
	if errPrices != nil {
		return electricityToday{}, errPrices
	}

	if errGen != nil || errMarket != nil || errTom != nil {
		a.logger.WarnContext(ctx, "esios partial data", "err", errors.Join(errGen, errMarket, errTom))
	}

	hours := buildHours(prices[indPVPC], prices[indPeriod], market[indMarket], gen[indDemand], gen)
	out := summarizeDay(hours, "esios")

	for _, m := range tomorrow[indMarket] {
		out.TomorrowMarket = append(out.TomorrowMarket, marketHour{Start: m.Time, Market: round4(m.Value / 1000)})
	}

	return out, nil
}

// loadTodayREData es el respaldo sin token: solo el PVPC por horas (apidatos.ree.es, público).
func (a *api) loadTodayREData(ctx context.Context, day, _ time.Time) (electricityToday, error) {
	prices, err := a.src.PVPC(ctx, day)
	if err != nil {
		return electricityToday{}, err
	}

	hours := make([]hourInfo, len(prices))
	for i, p := range prices {
		hours[i] = hourInfo{Start: p.Start, Price: round4(p.EURPerMWh / 1000)}
	}

	return summarizeDay(hours, "redata"), nil
}

// ---------- utilidades ----------

// esiosSeries pide varios indicadores en paralelo. Falla si falla cualquiera.
func (a *api) esiosSeries(ctx context.Context, ids []int, geoID int, start, end time.Time, hourly bool) (map[int][]sources.ESIOSValue, error) {
	var (
		mu   sync.Mutex
		wg   sync.WaitGroup
		errs []error
	)

	out := make(map[int][]sources.ESIOSValue, len(ids))

	for _, id := range ids {
		wg.Go(func() {
			v, err := a.src.ESIOSIndicator(ctx, id, start, end, geoID, hourly)

			mu.Lock()
			defer mu.Unlock()

			if err != nil {
				errs = append(errs, err)

				return
			}

			out[id] = v
		})
	}

	wg.Wait()

	return out, errors.Join(errs...)
}

func lookup(series []sources.ESIOSValue, at time.Time) (float64, bool) {
	for _, v := range series {
		if v.Time.Equal(at) {
			return v.Value, true
		}
	}

	return 0, false
}

func valueAt(series []sources.ESIOSValue, at time.Time) float64 {
	v, _ := lookup(series, at)

	return v
}

// pct devuelve part/total en %, con un decimal.
func pct(part, total float64) float64 {
	if total <= 0 {
		return 0
	}

	return math.Round(part/total*1000) / 10
}

func round4(v float64) float64 { return math.Round(v*1e4) / 1e4 }
