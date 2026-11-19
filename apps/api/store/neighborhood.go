package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrNeighborhoodUnavailable = errors.New("no neighborhood edition imported")
	ErrNeighborhoodNotFound    = errors.New("neighborhood parent not found")
)

type NeighborhoodZones struct {
	Type          string                `json:"type"`
	Year          int                   `json:"year"`
	GeographyDate string                `json:"geographyDate"`
	Features      []NeighborhoodFeature `json:"features"`
}

type NeighborhoodFeature struct {
	Type       string           `json:"type"`
	Geometry   json.RawMessage  `json:"geometry"`
	Properties NeighborhoodZone `json:"properties"`
}

type NeighborhoodZone struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Level                  string   `json:"level"`
	Income                 *float64 `json:"income"`
	Population             *int64   `json:"population"`
	MeanAge                *float64 `json:"meanAge"`
	SinglePersonHouseholds *float64 `json:"singlePersonHouseholds"`
	Bounds                 string   `json:"bounds"`
}

func (s *Store) Neighborhood(ctx context.Context, parent *string) (NeighborhoodZones, error) {
	result := NeighborhoodZones{Type: "FeatureCollection", Features: []NeighborhoodFeature{}}
	var edition int64
	err := s.db.QueryRow(ctx, `
		SELECT id, year, geography_date::text
		FROM neighborhood_editions
		ORDER BY year DESC, geography_date DESC, id DESC
		LIMIT 1
	`).Scan(&edition, &result.Year, &result.GeographyDate)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrNeighborhoodUnavailable
	}
	if err != nil {
		return result, err
	}

	features, err := collect(ctx, s.db, `
		SELECT z.id, z.name, z.level, i.income, i.population, i.mean_age, i.single_person_households,
		       ST_AsGeoJSON(ST_ForcePolygonCCW(z.map_geom), 6),
		       concat_ws(',', ST_XMin(z.map_geom), ST_YMin(z.map_geom), ST_XMax(z.map_geom), ST_YMax(z.map_geom))
		FROM neighborhood_zones z
		LEFT JOIN neighborhood_indicators i ON i.edition_id = z.edition_id AND i.zone_id = z.id
		WHERE z.edition_id = $1 AND z.parent_id IS NOT DISTINCT FROM $2::text
		ORDER BY z.name, z.id
	`, []any{edition, parent}, func(rows pgx.Rows) (NeighborhoodFeature, error) {
		feature := NeighborhoodFeature{Type: "Feature"}
		p := &feature.Properties
		err := rows.Scan(&p.ID, &p.Name, &p.Level, &p.Income, &p.Population, &p.MeanAge,
			&p.SinglePersonHouseholds, &feature.Geometry, &p.Bounds)
		return feature, err
	})
	if err != nil {
		return result, err
	}
	if len(features) == 0 {
		return result, ErrNeighborhoodNotFound
	}
	result.Features = features
	return result, nil
}
