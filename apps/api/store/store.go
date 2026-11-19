// Package store guarda las capas ingeridas en PostGIS y las cruza con rutas. Todo el SQL vive aquí.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"civicpulse/api/geo"
	"civicpulse/api/sources"
)

// Distancias máximas a la ruta para cada capa, en metros.
const (
	StationRadiusM  = 1000
	CameraRadiusM   = 300
	IncidentRadiusM = 500
	maxStations     = 10
)

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

// ---------- Escritura (ingesta) ----------

// ReplaceFuelStations sustituye todas las gasolineras en una transacción: nunca se ve una capa a medias.
func (s *Store) ReplaceFuelStations(ctx context.Context, stations []sources.Station) error {
	return s.replace(ctx, "DELETE FROM fuel_stations", nil, func(b *pgx.Batch) {
		for _, st := range stations {
			b.Queue(`INSERT INTO fuel_stations (id, brand, address, town, schedule, price_g95, price_diesel, geom, source_date)
				VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography, $10)
				ON CONFLICT (id) DO NOTHING`,
				st.ID, st.Brand, st.Address, st.Town, st.Schedule,
				nullPrice(st.Prices[sources.FuelGasoline95]), nullPrice(st.Prices[sources.FuelDiesel]),
				st.Point[0], st.Point[1], st.UpdatedAt)
		}
	})
}

// ReplaceCameras sustituye las cámaras de una fuente ("madrid" o "dgt").
func (s *Store) ReplaceCameras(ctx context.Context, source string, cameras []sources.Camera) error {
	return s.replace(ctx, "DELETE FROM cameras WHERE source = $1", []any{source}, func(b *pgx.Batch) {
		for _, c := range cameras {
			b.Queue(`INSERT INTO cameras (id, source, name, image_url, geom)
				VALUES ($1, $2, $3, NULLIF($4, ''), ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
				ON CONFLICT (id) DO NOTHING`,
				c.ID, c.Source, c.Name, c.ImageURL, c.Point[0], c.Point[1])
		}
	})
}

// ReplaceIncidents sustituye las incidencias activas.
func (s *Store) ReplaceIncidents(ctx context.Context, incidents []sources.Incident) error {
	return s.replace(ctx, "DELETE FROM incidents", nil, func(b *pgx.Batch) {
		for _, in := range incidents {
			// Tramo si from != to; punto si coinciden.
			b.Queue(`INSERT INTO incidents (id, kind, cause, road, province, geom,
					management_type, abnormal_type, speed_limit, direction)
				VALUES ($1, $2, $3, $4, $5, (CASE WHEN $6::float8 = $8::float8 AND $7::float8 = $9::float8
					THEN ST_SetSRID(ST_MakePoint($6, $7), 4326)
					ELSE ST_SetSRID(ST_MakeLine(ST_MakePoint($6, $7), ST_MakePoint($8, $9)), 4326) END)::geography,
					$10, $11, NULLIF($12::real, 0), $13)
				ON CONFLICT (id) DO NOTHING`,
				in.ID, in.Kind, in.Cause, in.Road, in.Province, in.From[0], in.From[1], in.To[0], in.To[1],
				in.Management, in.Abnormal, in.SpeedLimit, in.Direction)
		}
	})
}

func (s *Store) replace(ctx context.Context, deleteSQL string, deleteArgs []any, fill func(*pgx.Batch)) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, deleteSQL, deleteArgs...); err != nil {
		return err
	}

	batch := &pgx.Batch{}
	fill(batch)

	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// RecordRun apunta el resultado de una ingesta. Si runErr != nil se conserva el último ok_at.
func (s *Store) RecordRun(ctx context.Context, layer string, rows int, runErr error) error {
	if runErr != nil {
		_, err := s.db.Exec(ctx, `INSERT INTO ingest_runs (layer, attempted_at, error) VALUES ($1, now(), $2)
			ON CONFLICT (layer) DO UPDATE SET attempted_at = now(), error = $2`, layer, runErr.Error())

		return err
	}

	_, err := s.db.Exec(ctx, `INSERT INTO ingest_runs (layer, ok_at, rows, attempted_at) VALUES ($1, now(), $2, now())
		ON CONFLICT (layer) DO UPDATE SET ok_at = now(), rows = $2, attempted_at = now(), error = NULL`, layer, rows)

	return err
}

// CountCameras cuenta las cámaras guardadas de una fuente.
func (s *Store) CountCameras(ctx context.Context, source string) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, "SELECT count(*) FROM cameras WHERE source = $1", source).Scan(&n)

	return n, err
}

// ---------- Lectura (cruces con la ruta) ----------

type Station struct {
	ID        string    `json:"id"`
	Brand     string    `json:"brand"`
	Address   string    `json:"address"`
	Position  geo.Point `json:"position"`
	Price     float64   `json:"price"`
	DistanceM int       `json:"distanceM"`
}

type Camera struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Source    string    `json:"source"`
	ImageURL  *string   `json:"imageUrl"`
	Position  geo.Point `json:"position"`
	AlongM    int       `json:"alongM"`
	DistanceM int       `json:"distanceM"`
}

type Incident struct {
	ID       string    `json:"id"`
	Kind     string    `json:"kind"`
	Cause    string    `json:"cause"`
	Road     string    `json:"road"`
	Position geo.Point `json:"position"`
	AlongM   int       `json:"alongM"`
}

// NearRoute devuelve lo que hay cerca de la ruta: gasolineras con precio de `fuel` (más baratas primero),
// cámaras e incidencias en el orden de la marcha.
func (s *Store) NearRoute(ctx context.Context, route []geo.Point, fuel sources.Fuel) ([]Station, []Camera, []Incident, error) {
	line, err := lineGeoJSON(route)
	if err != nil {
		return nil, nil, nil, err
	}

	priceCol, err := priceColumn(fuel)
	if err != nil {
		return nil, nil, nil, err
	}

	// La ruta como geometry (para ST_LineLocatePoint) y como geography (para distancias en metros).
	const withRoute = `WITH r AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g),
		rg AS (SELECT g, g::geography AS gg, ST_Length(g::geography) AS len FROM r) `

	stations, err := collect(ctx, s.db, withRoute+`
		SELECT id, brand, address, ST_X(geom::geometry), ST_Y(geom::geometry), `+priceCol+`::float8,
		       round(ST_Distance(geom, rg.gg))::int
		FROM fuel_stations, rg
		WHERE `+priceCol+` IS NOT NULL AND ST_DWithin(geom, rg.gg, $2)
		ORDER BY `+priceCol+`, ST_Distance(geom, rg.gg)
		LIMIT $3`, []any{line, StationRadiusM, maxStations},
		func(row pgx.Rows) (Station, error) {
			var st Station
			err := row.Scan(&st.ID, &st.Brand, &st.Address, &st.Position[0], &st.Position[1], &st.Price, &st.DistanceM)

			return st, err
		})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("stations near route: %w", err)
	}

	cameras, err := collect(ctx, s.db, withRoute+`
		SELECT id, name, source, image_url, ST_X(geom::geometry), ST_Y(geom::geometry),
		       round(ST_LineLocatePoint(rg.g, geom::geometry) * rg.len)::int, round(ST_Distance(geom, rg.gg))::int
		FROM cameras, rg
		WHERE ST_DWithin(geom, rg.gg, $2)
		ORDER BY 7`, []any{line, CameraRadiusM},
		func(row pgx.Rows) (Camera, error) {
			var c Camera
			err := row.Scan(&c.ID, &c.Name, &c.Source, &c.ImageURL, &c.Position[0], &c.Position[1], &c.AlongM, &c.DistanceM)

			return c, err
		})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("cameras near route: %w", err)
	}

	incidents, err := collect(ctx, s.db, withRoute+`, near AS (
		  SELECT id, kind, cause, road, ST_ClosestPoint(geom::geometry, rg.g) AS p, rg.g, rg.len
		  FROM incidents, rg WHERE ST_DWithin(geom, rg.gg, $2))
		SELECT id, kind, cause, road, ST_X(p), ST_Y(p), round(ST_LineLocatePoint(g, p) * len)::int
		FROM near ORDER BY 7`, []any{line, IncidentRadiusM},
		func(row pgx.Rows) (Incident, error) {
			var in Incident
			err := row.Scan(&in.ID, &in.Kind, &in.Cause, &in.Road, &in.Position[0], &in.Position[1], &in.AlongM)

			return in, err
		})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("incidents near route: %w", err)
	}

	return stations, cameras, incidents, nil
}

// Layers ingeridas; LayerUpdates devuelve una clave por cada una.
var Layers = []string{"fuel", "incidents", "cameras-dgt", "cameras-madrid"}

// LayerUpdates devuelve la última ingesta correcta de cada capa (RFC 3339), o nil si nunca se cargó de la
// fuente (p. ej. cámaras del Ayuntamiento servidas desde el fixture de respaldo).
func (s *Store) LayerUpdates(ctx context.Context) (map[string]*string, error) {
	out := make(map[string]*string, len(Layers))
	for _, l := range Layers {
		out[l] = nil
	}

	rows, err := s.db.Query(ctx, "SELECT layer, ok_at FROM ingest_runs WHERE ok_at IS NOT NULL")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			layer string
			at    time.Time
		)

		if err := rows.Scan(&layer, &at); err != nil {
			return nil, err
		}

		if _, known := out[layer]; known {
			v := at.UTC().Format(time.RFC3339)
			out[layer] = &v
		}
	}

	return out, rows.Err()
}

// ---------- utilidades ----------

func collect[T any](ctx context.Context, db *pgxpool.Pool, sql string, args []any, scan func(pgx.Rows) (T, error)) ([]T, error) {
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}

	out := []T{}

	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			rows.Close()

			return nil, err
		}

		out = append(out, v)
	}

	return out, rows.Err()
}

func lineGeoJSON(route []geo.Point) (string, error) {
	if len(route) < 2 {
		return "", errors.New("route needs at least two points")
	}

	b, err := json.Marshal(map[string]any{"type": "LineString", "coordinates": route})

	return string(b), err
}

// priceColumn traduce el combustible a una columna fija: nunca se interpola texto del cliente en el SQL.
func priceColumn(f sources.Fuel) (string, error) {
	switch f {
	case sources.FuelGasoline95:
		return "price_g95", nil
	case sources.FuelDiesel:
		return "price_diesel", nil
	default:
		return "", fmt.Errorf("unknown fuel %q", f)
	}
}

func nullPrice(p float64) *float64 {
	if p <= 0 {
		return nil
	}

	return &p
}
