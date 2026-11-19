package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"civicpulse/api/sources"
	"civicpulse/api/store"
)

// pinger es lo que el health check necesita de la base de datos (el pool de pgx, o un fake en tests).
type pinger interface {
	Ping(ctx context.Context) error
}

// api guarda lo que necesitan los handlers. Se construye una vez en main.
type api struct {
	logger         *slog.Logger
	db             pinger
	allowedOrigins []string

	store     *store.Store
	src       *sources.Client
	router    router                    // Valhalla; nil = solo CartoCiudad (sin bici)
	renfe     *renfeStatic              // GTFS estático de Renfe en memoria
	elecNow   *cached[electricityNow]   // generación y demanda de los últimos 5 min
	elecToday *cached[electricityToday] // precios y mezcla de hoy por horas
	transit   *cached[transitResponse]  // tiempo real de Cercanías
}

// newRouter es toda la superficie HTTP: middleware y cada ruta, en un solo sitio.
// Cada endpoint se describe antes en openapi.yaml.
func newRouter(a *api) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(requestLogger(a.logger))
	r.Use(chimw.Recoverer)
	// En el router raíz y no en /v1: así los preflight funcionan aunque la ruta aún no exista.
	r.Use(cors(a.allowedOrigins))

	r.Get("/healthz", a.handleHealth)

	r.Route("/v1", func(r chi.Router) {
		r.Get("/trip", a.handleTrip)
		r.Get("/neighborhood/zones", a.handleNeighborhood)
		r.Get("/electricity/now", a.handleElectricityNow)
		r.Get("/electricity/today", a.handleElectricityToday)
		r.Get("/transit/cercanias", a.handleCercanias)
	})

	return r
}

// handleHealth responde 200 si la API y su base de datos están arriba, 503 si la base de datos no.
func (a *api) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := a.db.Ping(ctx); err != nil {
		a.logger.WarnContext(ctx, "health check failed", "err", err)
		writeProblem(w, r, http.StatusServiceUnavailable, "database-unavailable", "La base de datos no responde.")

		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// writeProblem responde con un problem document RFC 9457. `code` es estable y es lo que leen los clientes.
func writeProblem(w http.ResponseWriter, r *http.Request, status int, code, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":      "about:blank",
		"title":     http.StatusText(status),
		"status":    status,
		"detail":    detail,
		"code":      code,
		"requestId": chimw.GetReqID(r.Context()),
	})
}
