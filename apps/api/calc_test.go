package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"civicpulse/api/geo"
	"civicpulse/api/routing"
	"civicpulse/api/sources"
)

func TestTripCost(t *testing.T) {
	// Sol → Campus Sur: 8 162 m, 6,5 l/100 km, 1,359 €/l, 20 días ida y vuelta.
	c := tripCost("g95", 8162, 6.5, 1.359, 20)
	if c.LitersPerTrip != 0.53 || c.EURPerTrip != 0.72 || c.EURPerMonth != 28.84 {
		t.Fatalf("unexpected cost: %+v", c)
	}
}

func series(start time.Time, step time.Duration, values ...float64) []sources.ESIOSValue {
	out := make([]sources.ESIOSValue, len(values))
	for i, v := range values {
		out[i] = sources.ESIOSValue{Time: start.Add(time.Duration(i) * step), Value: v}
	}

	return out
}

func TestSummarizeDay(t *testing.T) {
	start := time.Date(2026, 11, 19, 0, 0, 0, 0, madridTZ)
	prices := []float64{0.150, 0.100, 0.090, 0.095, 0.200, 0.300}

	hours := make([]hourInfo, len(prices))
	for i, p := range prices {
		hours[i] = hourInfo{Start: start.Add(time.Duration(i) * time.Hour), Price: p}
	}

	got := summarizeDay(hours, "esios")

	if got.Date != "2026-11-19" || got.Average != 0.1558 || got.Extremes == nil ||
		got.Extremes.Cheapest.Price != 0.09 || got.Extremes.Priciest.Price != 0.3 {
		t.Fatalf("unexpected summary: %+v", got)
	}

	want := []struct {
		hours, startHour int
		avg              float64
	}{{1, 2, 0.09}, {2, 2, 0.0925}, {3, 1, 0.095}}

	for i, w := range want {
		c := got.Cheapest[i]
		if c.Hours != w.hours || c.Start.Hour() != w.startHour || c.Average != w.avg {
			t.Errorf("cheapest %dh: got %+v, want start %d avg %v", w.hours, c, w.startHour, w.avg)
		}
	}

	if got.Cheapest[0].SavingPercent != 42 {
		t.Errorf("saving: got %d, want 42", got.Cheapest[0].SavingPercent)
	}
}

func TestBuildHours(t *testing.T) {
	start := time.Date(2026, 11, 19, 0, 0, 0, 0, madridTZ)
	h := time.Hour

	gen := map[int][]sources.ESIOSValue{}
	for _, tc := range techs {
		gen[tc.Indicator] = series(start, h, 0) // solo la primera hora tiene generación real
	}

	gen[551] = series(start, h, 6000)          // eólica
	gen[549] = series(start, h, 3000)          // nuclear
	gen[550] = series(start, h, 1000)          // ciclo combinado
	gen[indExchanges] = series(start, h, -500) // exporta: no suma
	gen[indPumping] = series(start, h, -1200)  // bombeo consumiendo

	hours := buildHours(
		series(start, h, 91.5, 180), // PVPC €/MWh
		series(start, h, 3, 1),      // valle, punta
		series(start, h, 7.1),       // mercado: solo la primera hora
		series(start, h, 22000),     // demanda
		gen,
	)

	if len(hours) != 2 {
		t.Fatalf("got %d hours", len(hours))
	}

	first := hours[0]
	if first.Price != 0.0915 || *first.Market != 0.0071 || *first.Regulated != 0.0844 || *first.Period != "valle" ||
		*first.DemandMW != 22000 || *first.RenewableShare != 60 || *first.WindShare != 60 || *first.SolarShare != 0 {
		t.Fatalf("first hour: %+v", first)
	}

	if first.Generation == nil || first.Generation.Wind != 6000 || first.Generation.Nuclear != 3000 ||
		first.Generation.Gas != 1000 || first.Generation.Exports != 500 || first.Generation.Pumping != 1200 {
		t.Fatalf("first hour generation: %+v", first.Generation)
	}

	second := hours[1]
	if *second.Period != "punta" || second.Market != nil || second.RenewableShare != nil || second.DemandMW != nil || second.Generation != nil {
		t.Fatalf("second hour should only have price and period: %+v", second)
	}
}

func TestBuildNow(t *testing.T) {
	at := time.Date(2026, 11, 19, 15, 35, 0, 0, madridTZ)
	one := func(v float64) []sources.ESIOSValue { return series(at, 5*time.Minute, v) }

	// Valores reales de ESIOS del 19/11/2026 a las 15:35.
	s := map[int][]sources.ESIOSValue{
		indDemand: one(32300), indDemandForecast: one(32100), indCO2: one(0.030977),
		indExchanges: one(-4353), indBaleares: one(-51), indPumping: one(-4097), indBatteriesCharge: one(-7),
		1295: one(15694), 551: one(13739), 2080: one(1427), 1294: one(368), 1296: one(269),
		549: one(6086), 550: one(2002), 1297: one(928), 547: one(0), 548: one(0), 2079: one(0), 2167: one(0),
	}

	got, ok := buildNow(s)
	if !ok {
		t.Fatal("no snapshot")
	}

	if got.DemandMW != 32300 || *got.ForecastMW != 32100 || got.GenerationMW != 40513 || got.CO2GPerKWh != 31 {
		t.Fatalf("totals: %+v", got)
	}

	if got.Mix[0].ID != "solar-pv" || got.Mix[0].Share != 38.7 || got.Mix[1].ID != "wind" || got.RenewableShare != 77.7 {
		t.Fatalf("mix: %+v renewable %v", got.Mix[:2], got.RenewableShare)
	}

	for _, m := range got.Mix {
		if m.MW == 0 || m.ID == "imports" {
			t.Fatalf("mix should skip zero and imports when exporting: %+v", m)
		}
	}

	if got.Flows.ExportsMW != 4353 || got.Flows.PumpingMW != 4097 {
		t.Fatalf("flows: %+v", got.Flows)
	}
}

func TestCercaniasStatus(t *testing.T) {
	gtfs := sources.RenfeGTFS{
		TripRoute:  map[string]string{"a": "10T0007C3", "b": "10T0007C3", "c": "10T0001C10", "x": "40T0001C1"},
		RouteShort: map[string]string{"10T0007C3": "C3", "10T0001C10": "C10", "40T0001C1": "C1"},
	}
	delays := []sources.TripDelay{{TripID: "a", DelayS: 30}, {TripID: "b", DelayS: 720}, {TripID: "c", DelayS: 0}, {TripID: "x", DelayS: 900}}
	alerts := []sources.Alert{{Text: "#MadC3 obras", RouteIDs: []string{"10T0007C3", "10T0007C3"}}, {Text: "Valencia", RouteIDs: []string{"40T0001C1"}}}

	got := cercaniasStatus(gtfs, delays, alerts)

	if len(got) != 2 || got[0].Line != "C3" || got[1].Line != "C10" {
		t.Fatalf("lines: %+v", got)
	}

	if c3 := got[0]; c3.Trains != 2 || c3.DelayedTrains != 1 || c3.MaxDelayMin != 12 || len(c3.Alerts) != 1 {
		t.Fatalf("C3: %+v", c3)
	}
}

func TestTripValidation(t *testing.T) {
	h := newRouter(&api{logger: slog.New(slog.NewTextHandler(io.Discard, nil)), db: fakeDB{}})

	for _, q := range []string{
		"",
		"orig=40.4,-3.7",
		"orig=40.4,-3.7&dest=abc",
		"orig=40.4,-3.7&dest=40.39,-3.63&fuel=hydrogen",
		"orig=40.4,-3.7&dest=40.39,-3.63&consumption=50",
		"orig=40.4,-3.7&dest=40.39,-3.63&days=0",
		"orig=40.4,-3.7&dest=40.39,-3.63&mode=plane",
	} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/trip?"+q, nil))

		if rec.Code != http.StatusBadRequest || rec.Header().Get("Content-Type") != "application/problem+json" {
			t.Errorf("%q: got %d %s", q, rec.Code, rec.Header().Get("Content-Type"))
		}
	}
}

func TestCompareLines(t *testing.T) {
	lines := []string{"C10", "C4b", "C1", "C4a", "C8a", "C2"}
	slices.SortFunc(lines, compareLines)

	if got := strings.Join(lines, " "); got != "C1 C2 C4a C4b C8a C10" {
		t.Fatalf("got %s", got)
	}
}

func TestParseLatLng(t *testing.T) {
	p, ok := parseLatLng("40.3896,-3.6283")
	if !ok || p[0] != -3.6283 || p[1] != 40.3896 {
		t.Fatalf("got %v %v", p, ok)
	}

	if _, ok := parseLatLng("95,0"); ok {
		t.Fatal("latitude out of range accepted")
	}
}

func TestEstimateDelay(t *testing.T) {
	// 300 m a 20 km/h (54 s) en una vía donde se iba a 36 km/h (30 s): 24 s de retraso.
	if d := estimateDelay(300, 10, "slowTraffic"); d < 23.9 || d > 24.1 {
		t.Fatalf("got %v", d)
	}

	// Si la ruta ya iba más lenta que el atasco, no hay retraso; un tipo desconocido tampoco suma.
	if d := estimateDelay(300, 2, "slowTraffic"); d != 0 {
		t.Fatalf("got %v", d)
	}

	if d := estimateDelay(300, 10, "roadClosed"); d != 0 {
		t.Fatalf("got %v", d)
	}
}

func TestClosureBox(t *testing.T) {
	b := closureBox(geo.Point{-3.7, 40.4})
	if len(b) != 5 || b[0] != b[4] {
		t.Fatalf("not a closed ring: %v", b)
	}

	// Lado de ~60 m en ambos ejes.
	if w := geo.DistanceM(b[0], b[1]); w < 58 || w > 62 {
		t.Fatalf("width %v", w)
	}

	if h := geo.DistanceM(b[1], b[2]); h < 58 || h > 62 {
		t.Fatalf("height %v", h)
	}
}

type fakeRouter struct{ err error }

func (f fakeRouter) Route(context.Context, routing.Request) (routing.Route, error) {
	return routing.Route{}, f.err
}

func TestComputeRouteFallback(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	req := routing.Request{Orig: geo.Point{-3.7, 40.4}, Dest: geo.Point{-3.63, 40.39}, Mode: routing.ModeBike}

	// Sin Valhalla no hay bici: CartoCiudad no tiene ese perfil (y no se llega a llamar).
	for _, rt := range []router{nil, fakeRouter{err: routing.ErrUnavailable}} {
		a := &api{logger: logger, router: rt}
		if _, _, err := a.computeRoute(context.Background(), req); !errors.Is(err, routing.ErrUnavailable) {
			t.Fatalf("router %v: got %v", rt, err)
		}
	}

	// «Sin ruta» de Valhalla es definitivo: no se reintenta con CartoCiudad.
	a := &api{logger: logger, router: fakeRouter{err: routing.ErrNotFound}}

	req.Mode = routing.ModeCar
	if _, engine, err := a.computeRoute(context.Background(), req); !errors.Is(err, routing.ErrNotFound) || engine != "valhalla" {
		t.Fatalf("got %q %v", engine, err)
	}
}
