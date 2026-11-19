package main

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode"

	"civicpulse/api/sources"
)

type transitResponse struct {
	UpdatedAt time.Time    `json:"updatedAt"`
	Lines     []lineStatus `json:"lines"`
}

type lineStatus struct {
	Line          string   `json:"line"`
	Trains        int      `json:"trains"`
	DelayedTrains int      `json:"delayedTrains"`
	MaxDelayMin   int      `json:"maxDelayMin"`
	Alerts        []string `json:"alerts"`
}

// cercaniasStatus cruza el tiempo real con el GTFS estático y agrupa por línea de Cercanías Madrid.
func cercaniasStatus(gtfs sources.RenfeGTFS, delays []sources.TripDelay, alerts []sources.Alert) []lineStatus {
	byLine := map[string]*lineStatus{}
	line := func(routeID string) *lineStatus {
		name, ok := gtfs.RouteShort[routeID]
		if !ok || !sources.IsMadrid(routeID) {
			return nil
		}

		if byLine[name] == nil {
			byLine[name] = &lineStatus{Line: name, Alerts: []string{}}
		}

		return byLine[name]
	}

	for _, d := range delays {
		l := line(gtfs.TripRoute[d.TripID])
		if l == nil {
			continue
		}

		l.Trains++

		if d.DelayS >= 60 {
			l.DelayedTrains++
			l.MaxDelayMin = max(l.MaxDelayMin, d.DelayS/60)
		}
	}

	for _, a := range alerts {
		seen := map[string]bool{}

		for _, routeID := range a.RouteIDs {
			l := line(routeID)
			if l == nil || seen[l.Line] || a.Text == "" {
				continue
			}

			seen[l.Line] = true
			l.Alerts = append(l.Alerts, strings.TrimSpace(a.Text))
		}
	}

	out := make([]lineStatus, 0, len(byLine))
	for _, l := range byLine {
		out = append(out, *l)
	}

	slices.SortFunc(out, func(a, b lineStatus) int { return compareLines(a.Line, b.Line) })

	return out
}

// compareLines ordena C1, C2… C4a, C4b… C10 por número y después por sufijo.
func compareLines(a, b string) int {
	na, sa := lineNumber(a)
	nb, sb := lineNumber(b)

	if na != nb {
		return na - nb
	}

	return strings.Compare(sa, sb)
}

func lineNumber(line string) (int, string) {
	digits := strings.TrimLeftFunc(strings.TrimPrefix(line, "C"), unicode.IsDigit)
	n, _ := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(line, "C"), digits))

	return n, digits
}

// renfeStatic mantiene el GTFS estático de Renfe en memoria (16 MB comprimido; solo guardamos viaje → línea).
type renfeStatic struct {
	v atomic.Pointer[sources.RenfeGTFS]
}

// keepFresh lo descarga al arrancar y una vez al día, hasta que se cancele ctx.
func (s *renfeStatic) keepFresh(ctx context.Context, logger *slog.Logger, src *sources.Client) {
	for {
		loadCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		gtfs, err := src.RenfeStaticGTFS(loadCtx)
		cancel()

		wait := 24 * time.Hour
		if err != nil {
			logger.WarnContext(ctx, "renfe gtfs failed", "err", err)
			wait = 10 * time.Minute
		} else {
			s.v.Store(&gtfs)
			logger.InfoContext(ctx, "renfe gtfs ok", "trips", len(gtfs.TripRoute), "service_end", gtfs.ServiceEnd)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
	}
}

func (a *api) handleCercanias(w http.ResponseWriter, r *http.Request) {
	gtfs := a.renfe.v.Load()
	if gtfs == nil {
		writeProblem(w, r, http.StatusServiceUnavailable, "transit-not-ready", "Aún se están cargando los horarios de Renfe.")

		return
	}

	status, err := a.transit.get(r.Context(), "madrid", func(ctx context.Context) (transitResponse, error) {
		delays, err := a.src.RenfeTripDelays(ctx)
		if err != nil {
			return transitResponse{}, err
		}

		alerts, err := a.src.RenfeAlerts(ctx)
		if err != nil {
			return transitResponse{}, err
		}

		return transitResponse{UpdatedAt: time.Now().UTC(), Lines: cercaniasStatus(*gtfs, delays, alerts)}, nil
	})
	if err != nil {
		a.logger.WarnContext(r.Context(), "renfe realtime failed", "err", err)
		writeProblem(w, r, http.StatusBadGateway, "transit-unavailable", "Renfe no responde ahora mismo.")

		return
	}

	writeJSON(w, http.StatusOK, status)
}
