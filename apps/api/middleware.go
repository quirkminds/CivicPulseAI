package main

import (
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

// requestLogger escribe una línea por petición con nombres de atributo de OpenTelemetry.
// Registra el patrón de la ruta, nunca la ruta ni la query reales (pueden llevar coordenadas del usuario).
func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
			requestID := chimw.GetReqID(r.Context())
			ww.Header().Set("X-Request-Id", requestID)

			next.ServeHTTP(ww, r)

			status := ww.Status()
			level := slog.LevelInfo

			switch {
			case status >= 500:
				level = slog.LevelError
			case status >= 400:
				level = slog.LevelWarn
			}

			logger.Log(r.Context(), level, "request",
				"request_id", requestID,
				"http.request.method", r.Method,
				"http.route", chi.RouteContext(r.Context()).RoutePattern(),
				"http.response.status_code", status,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

// cors deja llamar a la API solo desde los orígenes de ALLOWED_ORIGINS. La API es de solo lectura y
// sin sesiones, así que no hace falta Allow-Credentials.
func cors(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			h := w.Header()
			h.Add("Vary", "Origin")

			allowed := slices.Contains(allowedOrigins, origin)
			if allowed {
				h.Set("Access-Control-Allow-Origin", origin)
			}

			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				if allowed {
					h.Set("Access-Control-Allow-Methods", "GET")
					h.Set("Access-Control-Allow-Headers", "Content-Type")
					h.Set("Access-Control-Max-Age", "600")
				}

				w.WriteHeader(http.StatusNoContent)

				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
