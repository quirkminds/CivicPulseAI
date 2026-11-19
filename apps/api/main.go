// Command api es el backend de CivicPulse: ingesta de fuentes oficiales y API para la web.
// Un único binario configurado por variables de entorno (ver .env.example).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"civicpulse/api/migrations"
)

func main() {
	// Valores locales de desarrollo (gitignored). Nunca pisa variables ya definidas y en el VPS no hace nada.
	_ = godotenv.Load(".env.local")

	// `api probe`: comprueba que cada fuente oficial responde y que sus datos se cruzan (no arranca el servidor).
	if len(os.Args) > 1 && os.Args[1] == "probe" {
		if err := runProbe(context.Background(), os.Stdout); err != nil {
			slog.Error("probe failed", "err", err)
			os.Exit(1)
		}

		return
	}

	if err := run(context.Background(), os.Getenv); err != nil {
		slog.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, getenv func(string) string) error {
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	logger := newLogger(getenv("LOG_FORMAT"))
	slog.SetDefault(logger)

	// Sin valores por defecto: direcciones y credenciales vienen solo del entorno.
	env, err := requireEnv(getenv, "ADDR", "DATABASE_URL", "ALLOWED_ORIGINS")
	if err != nil {
		return err
	}

	db, err := pgxpool.New(ctx, env["DATABASE_URL"])
	if err != nil {
		// Sin envolver: el error de parseo puede incluir la URL, contraseña incluida.
		return errors.New("DATABASE_URL is not a valid connection string")
	}
	defer db.Close()

	if err := migrations.Up(ctx, db); err != nil {
		return err
	}

	server := &http.Server{
		Addr: env["ADDR"],
		Handler: newRouter(&api{
			logger:         logger,
			db:             db,
			allowedOrigins: splitList(env["ALLOWED_ORIGINS"]),
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	serveErr := make(chan error, 1)

	go func() {
		logger.Info("api listening", "addr", server.Addr)
		serveErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}

	// Deja terminar las peticiones en curso antes de salir.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}

	logger.Info("api stopped cleanly")

	return nil
}

func newLogger(format string) *slog.Logger {
	if format == "json" {
		return slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}

	return slog.New(slog.NewTextHandler(os.Stdout, nil))
}

func requireEnv(getenv func(string) string, keys ...string) (map[string]string, error) {
	values := make(map[string]string, len(keys))

	var missing []string

	for _, key := range keys {
		if values[key] = getenv(key); values[key] == "" {
			missing = append(missing, key)
		}
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf("missing %s: copy .env.example to .env.local (development) or set them in the service environment", strings.Join(missing, ", "))
	}

	return values, nil
}

func splitList(value string) []string {
	var items []string

	for item := range strings.SplitSeq(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}

	return items
}
