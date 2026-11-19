package routing

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"civicpulse/api/geo"
)

func TestBuildRequest(t *testing.T) {
	req := Request{Orig: geo.Point{-3.70, 40.41}, Dest: geo.Point{-3.62, 40.38}, Mode: ModeBike,
		Exclude: [][]geo.Point{{{-3.6, 40.3}, {-3.5, 40.3}, {-3.5, 40.4}, {-3.6, 40.3}}}}

	raw, err := json.Marshal(buildRequest(req))
	if err != nil {
		t.Fatal(err)
	}

	var got struct {
		Locations []struct{ Lat, Lon float64 } `json:"locations"`
		Costing   string                       `json:"costing"`
		Options   struct {
			Bicycle struct {
				Type string `json:"bicycle_type"`
			} `json:"bicycle"`
		} `json:"costing_options"`
		Directions struct {
			Language string `json:"language"`
		} `json:"directions_options"`
		Exclude [][][2]float64 `json:"exclude_polygons"`
	}

	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}

	// Valhalla recibe lat/lon por separado (nosotros usamos [lng, lat]) y los polígonos en [lng, lat].
	if got.Locations[0].Lat != 40.41 || got.Locations[0].Lon != -3.70 || got.Costing != "bicycle" ||
		got.Options.Bicycle.Type != "Hybrid" || got.Directions.Language != "es-ES" ||
		len(got.Exclude) != 1 || got.Exclude[0][0] != [2]float64{-3.6, 40.3} {
		t.Fatalf("unexpected request %s", raw)
	}

	car, _ := json.Marshal(buildRequest(Request{Mode: ModeCar}))
	if string(car) == "" || json.Unmarshal(car, &got) != nil || got.Costing != "auto" {
		t.Fatalf("car costing: %s", car)
	}
}

func TestParseResponse(t *testing.T) {
	// Respuesta real de Valhalla 3.9.1 (OSM Madrid, 19/11/2026): Tirso de Molina → Plaza Mayor en coche.
	// Por los sentidos únicos rodea por Calle de Atocha (988 m); la vuelta son 481 m.
	raw, err := os.ReadFile("testdata/route-tirso-plaza-mayor.json")
	if err != nil {
		t.Fatal(err)
	}

	r, err := parseResponse(raw)
	if err != nil {
		t.Fatal(err)
	}

	if r.DistanceM != 988 || r.DurationS != 193.028 || len(r.Coordinates) != 99 || len(r.Maneuvers) != 9 {
		t.Fatalf("unexpected route: %v m, %v s, %d points, %d maneuvers",
			r.DistanceM, r.DurationS, len(r.Coordinates), len(r.Maneuvers))
	}

	atocha := r.Maneuvers[3]
	if atocha.Type != "slight-right" || atocha.Street != "Calle de Atocha" || atocha.DistanceM != 432 ||
		atocha.DurationS != 68 || atocha.BeginIndex != 17 || atocha.Position != r.Coordinates[17] {
		t.Fatalf("unexpected maneuver %+v", atocha)
	}

	if r.Maneuvers[0].Type != "start" || r.Maneuvers[4].Type != "sharp-left" ||
		r.Maneuvers[8].Type != "arrive" || r.Maneuvers[8].Street != "" {
		t.Fatalf("unexpected maneuver types %+v", r.Maneuvers)
	}

	if _, err := parseResponse([]byte(`{"trip":{"legs":[]}}`)); !errors.Is(err, ErrNotFound) {
		t.Fatalf("empty legs: %v", err)
	}
}

func TestModeValid(t *testing.T) {
	if !ModeWalk.Valid() || Mode("plane").Valid() {
		t.Fatal("mode validation")
	}
}
