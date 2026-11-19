package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"civicpulse/api/geo"
)

// Criterios para decidir que una incidencia DGT está en la ruta y no en una carretera que solo la cruza.
const (
	// La DGT da un tramo solo por sus extremos (en la base, una recta entre ellos). Cuenta si ambos extremos
	// quedan a esta distancia de la ruta: la recta puede alejarse de la carretera real en las curvas.
	endpointMatchM = 50
	// Las incidencias puntuales (cortes) tienen que estar sobre la propia vía.
	pointMatchM     = 25
	minOverlapM     = 100 // un tramo que la ruta solo cruza da un solape casi nulo
	pointIncidentsM = 300 // longitud supuesta de una incidencia puntual (la DGT no da longitud de cola)
)

// TrafficSpot es una incidencia DGT que la ruta recorre: un corte o un tramo con tráfico lento.
type TrafficSpot struct {
	ID       string
	Road     string
	Type     string    // management_type (cortes) o abnormal_type (tráfico lento)
	LengthM  float64   // metros de ruta afectados
	Position geo.Point // punto de la ruta dentro de la incidencia
}

// spotsOnRoute devuelve las incidencias que cumplen `filter` y que la ruta recorre en su mismo sentido.
func (s *Store) spotsOnRoute(ctx context.Context, route []geo.Point, filter, typeCol string) ([]TrafficSpot, error) {
	line, err := lineGeoJSON(route)
	if err != nil {
		return nil, err
	}

	// Para cada incidencia, la fracción de la ruta donde caen su inicio (fa) y su fin (fb).
	// - Puntual: basta con estar sobre la ruta.
	// - Tramo: fb > fa significa que la ruta lo recorre en el sentido de la incidencia; si fb < fa, es la
	//   calzada contraria y no afecta. El solape es la longitud de ruta entre fa y fb.
	sql := `WITH r AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g),
		rl AS (SELECT g, g::geography AS gg, ST_Length(g::geography) AS len FROM r),
		cand AS (
		  SELECT i.id, i.road, ` + typeCol + ` AS type,
		         GeometryType(i.geom::geometry) = 'POINT' AS is_point,
		         ST_StartPoint(i.geom::geometry) AS a, ST_EndPoint(i.geom::geometry) AS b, i.geom
		  FROM incidents i, rl
		  WHERE ` + filter + ` AND ST_DWithin(i.geom, rl.gg, $2)),
		hit AS (
		  SELECT c.id, c.road, c.type, c.is_point,
		         ST_LineLocatePoint(rl.g, COALESCE(c.a, c.geom::geometry)) AS fa,
		         ST_LineLocatePoint(rl.g, COALESCE(c.b, c.geom::geometry)) AS fb, rl.len, rl.g
		  FROM cand c, rl
		  WHERE (c.is_point AND ST_DWithin(c.geom, rl.gg, $3))
		     OR (NOT c.is_point AND ST_DWithin(c.a::geography, rl.gg, $2) AND ST_DWithin(c.b::geography, rl.gg, $2)))
		SELECT id, road, type,
		       CASE WHEN is_point THEN $5 ELSE (fb - fa) * len END AS len,
		       ST_X(p), ST_Y(p)
		FROM (SELECT *, ST_LineInterpolatePoint(g, CASE WHEN is_point THEN fa ELSE (fa + fb) / 2 END) AS p FROM hit) x
		WHERE is_point OR (fb - fa) * len >= $4
		ORDER BY fa`

	return collect(ctx, s.db, sql, []any{line, endpointMatchM, pointMatchM, minOverlapM, pointIncidentsM},
		func(row pgx.Rows) (TrafficSpot, error) {
			var t TrafficSpot
			err := row.Scan(&t.ID, &t.Road, &t.Type, &t.LengthM, &t.Position[0], &t.Position[1])

			return t, err
		})
}

// ClosuresOnRoute: cortes totales de vía (roadClosed) que la ruta atraviesa. Los de calzada o carril no se
// incluyen: sin un sentido fiable, esquivarlos podría bloquear rutas válidas.
func (s *Store) ClosuresOnRoute(ctx context.Context, route []geo.Point) ([]TrafficSpot, error) {
	spots, err := s.spotsOnRoute(ctx, route, "i.management_type = 'roadClosed'", "i.management_type")
	if err != nil {
		return nil, fmt.Errorf("closures on route: %w", err)
	}

	return spots, nil
}

// SlowTrafficOnRoute: tramos de la ruta con tráfico lento, retenciones o tráfico parado según la DGT.
func (s *Store) SlowTrafficOnRoute(ctx context.Context, route []geo.Point) ([]TrafficSpot, error) {
	spots, err := s.spotsOnRoute(ctx, route,
		"i.abnormal_type IN ('slowTraffic', 'heavyTraffic', 'queuingTraffic', 'stationaryTraffic')", "i.abnormal_type")
	if err != nil {
		return nil, fmt.Errorf("slow traffic on route: %w", err)
	}

	return spots, nil
}
