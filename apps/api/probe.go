package main

import (
	"context"
	"fmt"
	"io"
	"slices"
	"sync"
	"time"

	"civicpulse/api/geo"
	"civicpulse/api/sources"
)

// runProbe consulta cada fuente oficial y cruza los datos sobre rutas reales a los campus.
// Responde a «¿todo lo que queremos usar es consultable y hay datos suficientes para cruzar?».
// Uso: bun run --filter @civicpulse/api probe (o `go run . probe`).
func runProbe(ctx context.Context, out io.Writer) error {
	c := sources.NewClient()
	start := time.Now()

	// Todas las descargas en paralelo: son independientes.
	var (
		wg                           sync.WaitGroup
		madridCams, dgtCams          []sources.Camera
		incidents                    []sources.Incident
		stations                     []sources.Station
		delays                       []sources.TripDelay
		alerts                       []sources.Alert
		gtfs                         sources.RenfeGTFS
		pvpc                         []sources.HourPrice
		errMadrid, errDGTCam, errInc error
		errFuel, errRT, errAlerts    error
		errGTFS, errPVPC             error
	)

	run := func(f func()) { wg.Go(f) }
	run(func() { madridCams, errMadrid = c.MadridCameras(ctx) })
	run(func() { dgtCams, errDGTCam = c.DGTCameras(ctx) })
	run(func() { incidents, errInc = c.DGTIncidents(ctx) })
	run(func() { stations, errFuel = c.FuelStations(ctx, sources.ProvinceMadrid) })
	run(func() { delays, errRT = c.RenfeTripDelays(ctx) })
	run(func() { alerts, errAlerts = c.RenfeAlerts(ctx) })
	run(func() { gtfs, errGTFS = c.RenfeStaticGTFS(ctx) })
	run(func() { pvpc, errPVPC = c.PVPC(ctx, time.Now()) })

	routes := map[string]sources.Route{}
	routeErrs := map[string]error{}

	var mu sync.Mutex

	for _, dest := range probeCampuses {
		run(func() {
			r, err := c.Route(ctx, probeOrigin, dest.point, sources.VehicleCar)
			mu.Lock()
			defer mu.Unlock()
			routes[dest.name], routeErrs[dest.name] = r, err
		})
	}

	wg.Wait()

	madridArea := func(p geo.Point) bool { return geo.DistanceM(p, probeOrigin) < 60_000 }
	dgtMadrid := filter(dgtCams, func(c sources.Camera) bool { return madridArea(c.Point) })
	incMadrid := filter(incidents, func(i sources.Incident) bool { return i.Province == "Madrid" })

	fmt.Fprintf(out, "\nFUENTES (%s)\n", time.Since(start).Round(time.Millisecond))
	row := func(name string, err error, detail string) {
		status := "OK   "
		if err != nil {
			status, detail = "FALLO", err.Error()
		}

		fmt.Fprintf(out, "  %s  %-34s %s\n", status, name, detail)
	}

	for _, d := range probeCampuses {
		r := routes[d.name]
		row("CartoCiudad ruta → "+d.name, routeErrs[d.name],
			fmt.Sprintf("%.1f km · %.0f min sin tráfico · %d vértices", r.DistanceM/1000, r.DurationS/60, len(r.Coordinates)))
	}

	row("Ayto. Madrid cámaras (CCTV.kml)", errMadrid, fmt.Sprintf("%d cámaras", len(madridCams)))
	row("DGT cámaras (DATEX II)", errDGTCam, fmt.Sprintf("%d en España · %d a <60 km de Sol", len(dgtCams), len(dgtMadrid)))
	row("DGT incidencias (DATEX II)", errInc, fmt.Sprintf("%d en España · %d en la provincia de Madrid", len(incidents), len(incMadrid)))
	row("Ministerio carburantes (prov. 28)", errFuel, fuelSummary(stations))
	row("Renfe GTFS estático", errGTFS, fmt.Sprintf("%d viajes · %d paradas · calendario hasta %s", len(gtfs.TripRoute), gtfs.Stops, gtfs.ServiceEnd))
	row("Renfe GTFS-RT retrasos", errRT, rtSummary(delays, gtfs))
	row("Renfe GTFS-RT avisos", errAlerts, alertSummary(alerts))
	row("REE PVPC (REData, sin token)", errPVPC, pvpcSummary(pvpc))

	fmt.Fprintf(out, "\nCRUCES SOBRE LA RUTA EN COCHE (origen: Puerta del Sol)\n")

	for _, d := range probeCampuses {
		r, ok := routes[d.name]
		if !ok || len(r.Coordinates) == 0 {
			fmt.Fprintf(out, "  %s: sin ruta, no se puede cruzar\n", d.name)

			continue
		}

		near := func(p geo.Point, m float64) bool { return geo.DistanceToLineM(p, r.Coordinates) <= m }

		camsM := filter(madridCams, func(c sources.Camera) bool { return near(c.Point, 300) })
		camsD := filter(dgtCams, func(c sources.Camera) bool { return near(c.Point, 300) })
		inc := filter(incidents, func(i sources.Incident) bool { return near(i.From, 500) || near(i.To, 500) })
		gas := filter(stations, func(s sources.Station) bool { return s.Prices[sources.FuelGasoline95] > 0 && near(s.Point, 1000) })

		fmt.Fprintf(out, "  %s (%.1f km)\n", d.name, r.DistanceM/1000)
		fmt.Fprintf(out, "    cámaras Ayto. a ≤300 m:      %d\n", len(camsM))
		fmt.Fprintf(out, "    cámaras DGT a ≤300 m:        %d\n", len(camsD))
		fmt.Fprintf(out, "    incidencias DGT a ≤500 m:    %d\n", len(inc))
		fmt.Fprintf(out, "    gasolineras (G95) a ≤1 km:   %d%s\n", len(gas), cheapest(gas))
	}

	fmt.Fprintln(out)

	return nil
}

type probeCampus struct {
	name  string
	point geo.Point
}

var (
	probeOrigin   = geo.Point{-3.7038, 40.4168} // Puerta del Sol
	probeCampuses = []probeCampus{
		{"Campus Sur (ETSISI)", geo.Point{-3.6283, 40.3896}},
		{"Montegancedo (ETSIINF)", geo.Point{-3.8399, 40.4055}},
	}
)

func filter[T any](items []T, keep func(T) bool) []T {
	var out []T

	for _, it := range items {
		if keep(it) {
			out = append(out, it)
		}
	}

	return out
}

func fuelSummary(stations []sources.Station) string {
	g95 := filter(stations, func(s sources.Station) bool { return s.Prices[sources.FuelGasoline95] > 0 })
	diesel := filter(stations, func(s sources.Station) bool { return s.Prices[sources.FuelDiesel] > 0 })
	updated := ""

	if len(stations) > 0 {
		updated = " · actualizado " + stations[0].UpdatedAt
	}

	return fmt.Sprintf("%d gasolineras · %d con G95 · %d con gasóleo A%s", len(stations), len(g95), len(diesel), updated)
}

func cheapest(stations []sources.Station) string {
	if len(stations) == 0 {
		return ""
	}

	best := slices.MinFunc(stations, func(a, b sources.Station) int {
		return cmpFloat(a.Prices[sources.FuelGasoline95], b.Prices[sources.FuelGasoline95])
	})

	return fmt.Sprintf(" · la más barata: %s (%s) a %.3f €/l", best.Brand, best.Address, best.Prices[sources.FuelGasoline95])
}

func rtSummary(delays []sources.TripDelay, gtfs sources.RenfeGTFS) string {
	matched, madrid, late := 0, 0, 0

	for _, d := range delays {
		route, ok := gtfs.TripRoute[d.TripID]
		if !ok {
			continue
		}

		matched++

		if sources.IsMadrid(route) {
			madrid++

			if d.DelayS >= 60 {
				late++
			}
		}
	}

	if len(delays) == 0 {
		return "0 trenes"
	}

	return fmt.Sprintf("%d trenes · %d%% casan con el GTFS · %d en Madrid (%d con retraso ≥1 min)",
		len(delays), 100*matched/len(delays), madrid, late)
}

func alertSummary(alerts []sources.Alert) string {
	madrid := filter(alerts, func(a sources.Alert) bool { return slices.ContainsFunc(a.RouteIDs, sources.IsMadrid) })

	return fmt.Sprintf("%d avisos · %d afectan a Cercanías Madrid", len(alerts), len(madrid))
}

func pvpcSummary(prices []sources.HourPrice) string {
	if len(prices) == 0 {
		return "sin precios"
	}

	lo := slices.MinFunc(prices, func(a, b sources.HourPrice) int { return cmpFloat(a.EURPerMWh, b.EURPerMWh) })
	hi := slices.MaxFunc(prices, func(a, b sources.HourPrice) int { return cmpFloat(a.EURPerMWh, b.EURPerMWh) })

	return fmt.Sprintf("%d horas · más barata %s (%.0f €/MWh) · más cara %s (%.0f €/MWh)",
		len(prices), lo.Start.Format("15:04"), lo.EURPerMWh, hi.Start.Format("15:04"), hi.EURPerMWh)
}

func cmpFloat(a, b float64) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	default:
		return 0
	}
}
