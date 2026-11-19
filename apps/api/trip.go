package main

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"civicpulse/api/geo"
	"civicpulse/api/routing"
	"civicpulse/api/sources"
	"civicpulse/api/store"
)

// Valores por defecto de GET /v1/trip (ver openapi.yaml).
const (
	defaultConsumption = 6.5 // l/100 km, turismo medio de gasolina
	defaultDays        = 20  // días lectivos al mes
	closureBoxM        = 30  // semilado del cuadrado que se excluye alrededor de un corte
)

// fuels traduce el parámetro público al nombre de producto del Ministerio.
var fuels = map[string]sources.Fuel{"g95": sources.FuelGasoline95, "diesel": sources.FuelDiesel}

// slowSpeedsKmh es la velocidad supuesta en cada tipo de tráfico anómalo de la DGT. La DGT no publica
// velocidades ni longitud de cola: el retraso es una estimación y así se indica en la respuesta.
var slowSpeedsKmh = map[string]float64{
	"slowTraffic":       20,
	"heavyTraffic":      15,
	"queuingTraffic":    10,
	"stationaryTraffic": 5,
}

// router es lo que necesita el handler del motor de rutas (Valhalla, o un fake en tests).
type router interface {
	Route(ctx context.Context, req routing.Request) (routing.Route, error)
}

type tripResponse struct {
	Route     tripRoute          `json:"route"`
	Traffic   tripTraffic        `json:"traffic"`
	Cost      *carCost           `json:"cost"`
	Stations  []store.Station    `json:"stations"`
	Cameras   []store.Camera     `json:"cameras"`
	Incidents []store.Incident   `json:"incidents"`
	UpdatedAt map[string]*string `json:"updatedAt"`
}

type tripRoute struct {
	Engine    string `json:"engine"` // "valhalla" o "cartociudad" (respaldo)
	Mode      string `json:"mode"`
	DistanceM int    `json:"distanceM"`
	// Sin tráfico en vivo: velocidades por tipo de vía (Valhalla) o fijas (CartoCiudad).
	DurationS int `json:"durationS"`
	// DurationS + retraso estimado por los avisos de tráfico lento de la DGT.
	TrafficDurationS int                `json:"trafficDurationS"`
	Geometry         lineStringGJ       `json:"geometry"`
	Maneuvers        []routing.Maneuver `json:"maneuvers"`
}

type tripTraffic struct {
	// Cortes de vía (DGT) que la primera ruta atravesaba y que la ruta final esquiva.
	ClosuresAvoided []spotJSON `json:"closuresAvoided"`
	// Cortes que la ruta no ha podido esquivar (no hay alternativa).
	ClosuresOnRoute []spotJSON `json:"closuresOnRoute"`
	SlowSegments    []slowJSON `json:"slowSegments"`
}

type spotJSON struct {
	ID       string    `json:"id"`
	Road     string    `json:"road"`
	Position geo.Point `json:"position"`
}

type slowJSON struct {
	ID       string    `json:"id"`
	Road     string    `json:"road"`
	Type     string    `json:"type"`
	LengthM  int       `json:"lengthM"`
	DelayS   int       `json:"delayS"`
	Position geo.Point `json:"position"`
}

type lineStringGJ struct {
	Type        string      `json:"type"`
	Coordinates []geo.Point `json:"coordinates"`
}

type carCost struct {
	Fuel          string  `json:"fuel"`
	Consumption   float64 `json:"consumptionL100km"`
	PricePerLiter float64 `json:"pricePerLiter"`
	LitersPerTrip float64 `json:"litersPerTrip"`
	EURPerTrip    float64 `json:"eurPerTrip"`
	EURPerMonth   float64 `json:"eurPerMonth"`
	Days          int     `json:"days"`
}

// tripCost calcula el gasto en combustible: un trayecto es solo ida; el mes, ida y vuelta `days` días.
func tripCost(fuel string, distanceM, consumption, pricePerLiter float64, days int) carCost {
	liters := distanceM / 1000 * consumption / 100
	perTrip := liters * pricePerLiter

	return carCost{
		Fuel:          fuel,
		Consumption:   consumption,
		PricePerLiter: pricePerLiter,
		LitersPerTrip: round2(liters),
		EURPerTrip:    round2(perTrip),
		EURPerMonth:   round2(perTrip * 2 * float64(days)),
		Days:          days,
	}
}

// estimateDelay es el tiempo extra de recorrer lengthM a la velocidad del tipo de tráfico en vez de a la
// velocidad media de la ruta. Cero si el tramo ya iba más lento que eso.
func estimateDelay(lengthM, routeSpeedMS float64, trafficType string) float64 {
	kmh, ok := slowSpeedsKmh[trafficType]
	if !ok || lengthM <= 0 || routeSpeedMS <= 0 {
		return 0
	}

	slow := kmh / 3.6

	return max(lengthM/slow-lengthM/routeSpeedMS, 0)
}

// closureBox es un cuadrado de ~60 m centrado en p: excluirlo obliga a Valhalla a evitar esa vía.
func closureBox(p geo.Point) []geo.Point {
	dLat := closureBoxM / 111_320.0
	dLng := closureBoxM / (111_320.0 * math.Cos(p[1]*math.Pi/180))

	return []geo.Point{
		{p[0] - dLng, p[1] - dLat}, {p[0] + dLng, p[1] - dLat},
		{p[0] + dLng, p[1] + dLat}, {p[0] - dLng, p[1] + dLat},
		{p[0] - dLng, p[1] - dLat},
	}
}

type tripParams struct {
	orig, dest  geo.Point
	mode        routing.Mode
	fuelParam   string
	fuel        sources.Fuel
	consumption float64
	days        int
}

// parseTripParams valida la query. Devuelve el code y el detalle del problema si algo no vale.
func parseTripParams(r *http.Request) (tripParams, string, string) {
	q := r.URL.Query()

	var p tripParams

	var okO, okD bool

	p.orig, okO = parseLatLng(q.Get("orig"))
	p.dest, okD = parseLatLng(q.Get("dest"))

	if !okO || !okD {
		return p, "invalid-coordinates", "orig y dest deben ser «lat,lng»."
	}

	p.mode = routing.Mode(orDefault(q.Get("mode"), string(routing.ModeCar)))
	if !p.mode.Valid() {
		return p, "invalid-mode", "mode debe ser car, walk o bike."
	}

	p.fuelParam = orDefault(q.Get("fuel"), "g95")

	var ok bool

	if p.fuel, ok = fuels[p.fuelParam]; !ok {
		return p, "invalid-fuel", "fuel debe ser g95 o diesel."
	}

	var err error

	p.consumption, err = strconv.ParseFloat(orDefault(q.Get("consumption"), strconv.FormatFloat(defaultConsumption, 'f', -1, 64)), 64)
	if err != nil || p.consumption < 2 || p.consumption > 20 {
		return p, "invalid-consumption", "consumption debe estar entre 2 y 20 l/100 km."
	}

	p.days, err = strconv.Atoi(orDefault(q.Get("days"), strconv.Itoa(defaultDays)))
	if err != nil || p.days < 1 || p.days > 31 {
		return p, "invalid-days", "days debe estar entre 1 y 31."
	}

	return p, "", ""
}

func (a *api) handleTrip(w http.ResponseWriter, r *http.Request) {
	p, code, detail := parseTripParams(r)
	if code != "" {
		writeProblem(w, r, http.StatusBadRequest, code, detail)

		return
	}

	ctx := r.Context()

	route, engine, err := a.computeRoute(ctx, routing.Request{Orig: p.orig, Dest: p.dest, Mode: p.mode})
	if err != nil {
		a.writeRouteError(w, r, err)

		return
	}

	traffic := tripTraffic{ClosuresAvoided: []spotJSON{}, ClosuresOnRoute: []spotJSON{}, SlowSegments: []slowJSON{}}

	// Coche con Valhalla: si la ruta atraviesa un corte de la DGT, se recalcula excluyéndolo.
	if p.mode == routing.ModeCar && engine == "valhalla" {
		route, traffic, err = a.avoidClosures(ctx, p, route, traffic)
		if err != nil {
			a.logger.ErrorContext(ctx, "closures query failed", "err", err)
			writeProblem(w, r, http.StatusInternalServerError, "layers-unavailable", "No se pudieron cruzar las capas con la ruta.")

			return
		}
	}

	trafficDuration := route.DurationS

	if p.mode == routing.ModeCar {
		slow, err := a.store.SlowTrafficOnRoute(ctx, route.Coordinates)
		if err != nil {
			a.logger.ErrorContext(ctx, "slow traffic query failed", "err", err)
			writeProblem(w, r, http.StatusInternalServerError, "layers-unavailable", "No se pudieron cruzar las capas con la ruta.")

			return
		}

		speed := route.DistanceM / max(route.DurationS, 1)

		for _, s := range slow {
			delay := estimateDelay(s.LengthM, speed, s.Type)
			trafficDuration += delay
			traffic.SlowSegments = append(traffic.SlowSegments, slowJSON{
				ID: s.ID, Road: s.Road, Type: s.Type, LengthM: int(math.Round(s.LengthM)),
				DelayS: int(math.Round(delay)), Position: s.Position,
			})
		}
	}

	stations, cameras, incidents, err := a.store.NearRoute(ctx, route.Coordinates, p.fuel)
	if err != nil {
		a.logger.ErrorContext(ctx, "near route query failed", "err", err)
		writeProblem(w, r, http.StatusInternalServerError, "layers-unavailable", "No se pudieron cruzar las capas con la ruta.")

		return
	}

	updated, err := a.store.LayerUpdates(ctx)
	if err != nil {
		a.logger.ErrorContext(ctx, "layer updates query failed", "err", err)
		writeProblem(w, r, http.StatusInternalServerError, "layers-unavailable", "No se pudieron cruzar las capas con la ruta.")

		return
	}

	maneuvers := route.Maneuvers
	if maneuvers == nil {
		maneuvers = []routing.Maneuver{}
	}

	resp := tripResponse{
		Route: tripRoute{
			Engine:           engine,
			Mode:             string(p.mode),
			DistanceM:        int(math.Round(route.DistanceM)),
			DurationS:        int(math.Round(route.DurationS)),
			TrafficDurationS: int(math.Round(trafficDuration)),
			Geometry:         lineStringGJ{Type: "LineString", Coordinates: route.Coordinates},
			Maneuvers:        maneuvers,
		},
		Traffic:   traffic,
		Stations:  []store.Station{},
		Cameras:   []store.Camera{},
		Incidents: incidents,
		UpdatedAt: updated,
	}

	// Gasolineras, cámaras y coste solo tienen sentido en coche.
	if p.mode == routing.ModeCar {
		resp.Stations, resp.Cameras = stations, cameras

		// stations viene ordenada por precio: la primera es la más barata.
		if len(stations) > 0 {
			c := tripCost(p.fuelParam, route.DistanceM, p.consumption, stations[0].Price, p.days)
			resp.Cost = &c
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// computeRoute usa Valhalla y, si no está disponible, CartoCiudad (oficial, pero sin sentidos ni bici).
func (a *api) computeRoute(ctx context.Context, req routing.Request) (routing.Route, string, error) {
	if a.router != nil {
		route, err := a.router.Route(ctx, req)
		if err == nil || !errors.Is(err, routing.ErrUnavailable) {
			return route, "valhalla", err
		}

		a.logger.WarnContext(ctx, "valhalla unavailable, falling back to cartociudad", "err", err)
	}

	vehicle := map[routing.Mode]sources.Vehicle{routing.ModeCar: sources.VehicleCar, routing.ModeWalk: sources.VehicleWalk}[req.Mode]
	if vehicle == "" {
		return routing.Route{}, "", routing.ErrUnavailable
	}

	r, err := a.src.Route(ctx, req.Orig, req.Dest, vehicle)
	if err != nil {
		if errors.Is(err, sources.ErrNotFound) {
			return routing.Route{}, "", routing.ErrNotFound
		}

		return routing.Route{}, "", errors.Join(routing.ErrUnavailable, err)
	}

	return routing.Route{DistanceM: r.DistanceM, DurationS: r.DurationS, Coordinates: r.Coordinates}, "cartociudad", nil
}

// avoidClosures recalcula la ruta excluyendo los cortes totales de la DGT que atraviesa.
func (a *api) avoidClosures(ctx context.Context, p tripParams, route routing.Route, traffic tripTraffic) (routing.Route, tripTraffic, error) {
	closures, err := a.store.ClosuresOnRoute(ctx, route.Coordinates)
	if err != nil || len(closures) == 0 {
		return route, traffic, err
	}

	exclude := make([][]geo.Point, len(closures))
	for i, c := range closures {
		exclude[i] = closureBox(c.Position)
	}

	rerouted, err := a.router.Route(ctx, routing.Request{Orig: p.orig, Dest: p.dest, Mode: p.mode, Exclude: exclude})
	if err != nil {
		// Sin alternativa: se mantiene la ruta original y se avisa de los cortes que atraviesa.
		a.logger.WarnContext(ctx, "reroute around closures failed", "err", err)

		for _, c := range closures {
			traffic.ClosuresOnRoute = append(traffic.ClosuresOnRoute, spotJSON{ID: c.ID, Road: c.Road, Position: c.Position})
		}

		return route, traffic, nil
	}

	for _, c := range closures {
		traffic.ClosuresAvoided = append(traffic.ClosuresAvoided, spotJSON{ID: c.ID, Road: c.Road, Position: c.Position})
	}

	return rerouted, traffic, nil
}

func (a *api) writeRouteError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, routing.ErrNotFound):
		writeProblem(w, r, http.StatusNotFound, "route-not-found", "No hay ruta entre esos puntos.")
	default:
		a.logger.WarnContext(r.Context(), "route failed", "err", err)
		writeProblem(w, r, http.StatusServiceUnavailable, "routing-unavailable", "El motor de rutas no responde ahora mismo.")
	}
}

// parseLatLng lee «lat,lng» y devuelve [lng, lat].
func parseLatLng(s string) (geo.Point, bool) {
	latS, lngS, ok := strings.Cut(s, ",")
	if !ok {
		return geo.Point{}, false
	}

	lat, err1 := strconv.ParseFloat(strings.TrimSpace(latS), 64)
	lng, err2 := strconv.ParseFloat(strings.TrimSpace(lngS), 64)

	if err1 != nil || err2 != nil || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return geo.Point{}, false
	}

	return geo.Point{lng, lat}, true
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}

	return v
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
