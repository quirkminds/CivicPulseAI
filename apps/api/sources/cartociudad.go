package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"time"

	"civicpulse/api/geo"
)

const cartociudadRouteURL = "https://www.cartociudad.es/services/api/route"

// Vehicle es lo que admite CartoCiudad. Cualquier otro valor responde 200 con la ruta a pie,
// así que se valida aquí y nunca se pasa texto del cliente tal cual.
type Vehicle string

const (
	VehicleCar  Vehicle = "CAR"
	VehicleWalk Vehicle = "WALK"
)

func (v Vehicle) Valid() bool { return v == VehicleCar || v == VehicleWalk }

// Route es una ruta de CartoCiudad ya traducida: GeoJSON [lng, lat], metros y segundos.
// La duración usa velocidades fijas (urbana 30 km/h, autovía 100…) y no respeta sentidos: sin tráfico.
type Route struct {
	DistanceM   float64
	DurationS   float64
	Coordinates []geo.Point
}

// Route pide la ruta entre dos puntos.
func (c *Client) Route(ctx context.Context, orig, dest geo.Point, vehicle Vehicle) (Route, error) {
	if !vehicle.Valid() {
		return Route{}, fmt.Errorf("%w: vehicle %q", ErrBadResponse, vehicle)
	}

	q := url.Values{
		"orig":    {latLng(orig)},
		"dest":    {latLng(dest)},
		"locale":  {"es"},
		"vehicle": {string(vehicle)},
	}

	body, err := c.get(ctx, cartociudadRouteURL+"?"+q.Encode(), 10*time.Second)
	if err != nil {
		return Route{}, err
	}

	return parseCartociudadRoute(body)
}

func parseCartociudadRoute(body []byte) (Route, error) {
	// CartoCiudad devuelve los números como strings.
	var raw struct {
		Found    string `json:"found"`
		Distance string `json:"distance"`
		Time     string `json:"time"`
		Geom     string `json:"geom"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return Route{}, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	if raw.Found != "true" || raw.Geom == "" {
		return Route{}, ErrNotFound
	}

	distance, err1 := strconv.ParseFloat(raw.Distance, 64)
	ms, err2 := strconv.ParseFloat(raw.Time, 64)

	coords, err3 := decodePolyline(raw.Geom)
	if err1 != nil || err2 != nil || err3 != nil {
		return Route{}, fmt.Errorf("%w: unparseable route", ErrBadResponse)
	}

	return Route{DistanceM: distance, DurationS: ms / 1000, Coordinates: coords}, nil
}

// decodePolyline decodifica el formato comprimido de Google (precisión 5, pares lat,lng) a [lng, lat].
func decodePolyline(s string) ([]geo.Point, error) {
	var (
		points   []geo.Point
		lat, lng int
	)

	for i := 0; i < len(s); {
		var deltas [2]int

		for k := range deltas {
			result, shift := 0, 0

			for {
				if i >= len(s) {
					return nil, fmt.Errorf("truncated polyline")
				}

				b := int(s[i]) - 63
				i++
				result |= (b & 0x1f) << shift
				shift += 5

				if b < 0x20 {
					break
				}
			}

			if result&1 != 0 {
				deltas[k] = ^(result >> 1)
			} else {
				deltas[k] = result >> 1
			}
		}

		lat += deltas[0]
		lng += deltas[1]
		points = append(points, geo.Point{float64(lng) / 1e5, float64(lat) / 1e5})
	}

	return points, nil
}

func latLng(p geo.Point) string {
	return strconv.FormatFloat(round6(p[1]), 'f', -1, 64) + "," + strconv.FormatFloat(round6(p[0]), 'f', -1, 64)
}

func round6(v float64) float64 { return math.Round(v*1e6) / 1e6 }
