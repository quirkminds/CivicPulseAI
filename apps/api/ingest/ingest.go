// Package ingest carga periódicamente en PostGIS las capas que cambian poco (gasolineras, cámaras,
// incidencias). Cada capa tiene su intervalo; si una fuente falla, se conserva lo último bueno.
package ingest

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"civicpulse/api/geo"
	"civicpulse/api/sources"
	"civicpulse/api/store"
)

// Fixture de cámaras del Ayuntamiento (CCTV.kml del 19/11/2026, 357 cámaras). Se usa cuando informo.madrid.es
// no responde y la tabla está vacía: el Ayuntamiento corta la conexión desde algunas IPs.
//
//go:embed fallback/cameras-madrid.json
var madridCamerasFallback []byte

// Layer es una capa con su intervalo de refresco y cómo se carga.
type Layer struct {
	Name  string
	Every time.Duration
	Load  func(ctx context.Context) (rows int, err error)
}

// Layers devuelve las capas a ingerir.
func Layers(st *store.Store, src *sources.Client) []Layer {
	return []Layer{
		{Name: "fuel", Every: 30 * time.Minute, Load: func(ctx context.Context) (int, error) {
			stations, err := src.FuelStations(ctx, sources.ProvinceMadrid)
			if err != nil {
				return 0, err
			}

			return len(stations), st.ReplaceFuelStations(ctx, stations)
		}},
		{Name: "incidents", Every: 5 * time.Minute, Load: func(ctx context.Context) (int, error) {
			incidents, err := src.DGTIncidents(ctx)
			if err != nil {
				return 0, err
			}

			return len(incidents), st.ReplaceIncidents(ctx, incidents)
		}},
		{Name: "cameras-dgt", Every: 6 * time.Hour, Load: func(ctx context.Context) (int, error) {
			cameras, err := src.DGTCameras(ctx)
			if err != nil {
				return 0, err
			}

			return len(cameras), st.ReplaceCameras(ctx, "dgt", cameras)
		}},
		{Name: "cameras-madrid", Every: 24 * time.Hour, Load: func(ctx context.Context) (int, error) {
			cameras, err := src.MadridCameras(ctx)
			if err == nil {
				return len(cameras), st.ReplaceCameras(ctx, "madrid", cameras)
			}

			// Sin conexión: si ya hay cámaras guardadas se dejan; si no, se carga el fixture.
			if n, cerr := st.CountCameras(ctx, "madrid"); cerr != nil || n > 0 {
				return 0, err
			}

			fallback, ferr := parseCameraFixture(madridCamerasFallback)
			if ferr != nil {
				return 0, fmt.Errorf("%w; fallback: %w", err, ferr)
			}

			if rerr := st.ReplaceCameras(ctx, "madrid", fallback); rerr != nil {
				return 0, rerr
			}

			return 0, fmt.Errorf("%w (loaded %d cameras from the fallback fixture)", err, len(fallback))
		}},
	}
}

// Run ingiere todas las capas al arrancar y después cada una a su ritmo, hasta que se cancele ctx.
func Run(ctx context.Context, logger *slog.Logger, st *store.Store, layers []Layer) {
	for _, l := range layers {
		go func() {
			ticker := time.NewTicker(l.Every)
			defer ticker.Stop()

			for {
				runOnce(ctx, logger, st, l)

				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}
			}
		}()
	}
}

func runOnce(ctx context.Context, logger *slog.Logger, st *store.Store, l Layer) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	start := time.Now()
	rows, err := l.Load(ctx)

	if rerr := st.RecordRun(ctx, l.Name, rows, err); rerr != nil {
		logger.ErrorContext(ctx, "ingest record failed", "layer", l.Name, "err", rerr)
	}

	if err != nil {
		logger.WarnContext(ctx, "ingest failed", "layer", l.Name, "err", err, "duration_ms", time.Since(start).Milliseconds())

		return
	}

	logger.InfoContext(ctx, "ingest ok", "layer", l.Name, "rows", rows, "duration_ms", time.Since(start).Milliseconds())
}

// parseCameraFixture lee el GeoJSON de cámaras que también usa la web como dato de ejemplo.
func parseCameraFixture(body []byte) ([]sources.Camera, error) {
	var fc struct {
		Features []struct {
			Geometry struct {
				Coordinates geo.Point `json:"coordinates"`
			} `json:"geometry"`
			Properties struct {
				ID       string  `json:"id"`
				Name     string  `json:"name"`
				Source   string  `json:"source"`
				ImageURL *string `json:"imageUrl"`
			} `json:"properties"`
		} `json:"features"`
	}

	if err := json.Unmarshal(body, &fc); err != nil {
		return nil, err
	}

	out := make([]sources.Camera, 0, len(fc.Features))

	for _, f := range fc.Features {
		c := sources.Camera{ID: f.Properties.ID, Name: f.Properties.Name, Source: f.Properties.Source, Point: f.Geometry.Coordinates}
		if f.Properties.ImageURL != nil {
			c.ImageURL = *f.Properties.ImageURL
		}

		out = append(out, c)
	}

	return out, nil
}
