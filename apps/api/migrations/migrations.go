// Package migrations guarda el esquema como ficheros SQL, embebidos en el binario y aplicados en orden
// por goose. Nunca edites un fichero ya aplicado en algún sitio: corrige hacia delante con uno nuevo.
package migrations

import (
	"context"
	"embed"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

//go:embed *.sql
var files embed.FS

// Up aplica las migraciones pendientes. Un advisory lock de Postgres serializa llamadas concurrentes
// (dos instancias arrancando, o paquetes de test en paralelo).
func Up(ctx context.Context, pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	locker, err := lock.NewPostgresSessionLocker(lock.WithLockTimeout(1, 60))
	if err != nil {
		return fmt.Errorf("migrations: %w", err)
	}

	provider, err := goose.NewProvider(goose.DialectPostgres, db, files, goose.WithSessionLocker(locker))
	if err != nil {
		return fmt.Errorf("migrations: %w", err)
	}

	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	for _, result := range results {
		slog.InfoContext(ctx, "migration applied", "file", result.Source.Path, "duration", result.Duration)
	}

	return nil
}
