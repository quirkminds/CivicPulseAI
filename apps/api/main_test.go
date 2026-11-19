package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func newTestAPI(db pinger) http.Handler {
	return newRouter(&api{
		logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		db:             db,
		allowedOrigins: []string{"http://localhost:5173"},
	})
}

func TestHealth(t *testing.T) {
	tests := []struct {
		name   string
		db     pinger
		status int
	}{
		{"database up", fakeDB{}, http.StatusOK},
		{"database down", fakeDB{err: errors.New("down")}, http.StatusServiceUnavailable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			newTestAPI(tt.db).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}

			if rec.Header().Get("X-Request-Id") == "" {
				t.Fatal("missing X-Request-Id")
			}
		})
	}
}

func TestCORSPreflight(t *testing.T) {
	for _, origin := range []string{"http://localhost:5173", "https://evil.example"} {
		req := httptest.NewRequest(http.MethodOptions, "/v1/anything", nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodGet)

		rec := httptest.NewRecorder()
		newTestAPI(fakeDB{}).ServeHTTP(rec, req)

		got := rec.Header().Get("Access-Control-Allow-Origin")
		want := ""
		if origin == "http://localhost:5173" {
			want = origin
		}

		if got != want {
			t.Errorf("origin %s: Allow-Origin = %q, want %q", origin, got, want)
		}
	}
}

func TestRequireEnv(t *testing.T) {
	getenv := func(key string) string { return map[string]string{"ADDR": ":8080"}[key] }

	if _, err := requireEnv(getenv, "ADDR", "DATABASE_URL"); err == nil {
		t.Fatal("expected an error for missing DATABASE_URL")
	}
}
