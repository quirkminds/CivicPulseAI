// Package routing calcula rutas con Valhalla, el motor de rutas que corre en local sobre OpenStreetMap
// (servicio `valhalla` en compose.yaml). A diferencia de CartoCiudad, respeta sentidos únicos, giros
// prohibidos y límites de velocidad, tiene modo bici y devuelve indicaciones en castellano.
package routing

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"

	"civicpulse/api/geo"
)

// Errores propios: nunca se propaga el texto de Valhalla.
var (
	ErrUnavailable = errors.New("routing engine unavailable")
	ErrNotFound    = errors.New("no route between those points")
)

// Mode es el medio de transporte.
type Mode string

const (
	ModeCar  Mode = "car"
	ModeWalk Mode = "walk"
	ModeBike Mode = "bike"
)

func (m Mode) Valid() bool { return m == ModeCar || m == ModeWalk || m == ModeBike }

// costing traduce el modo al perfil de Valhalla.
var costing = map[Mode]string{ModeCar: "auto", ModeWalk: "pedestrian", ModeBike: "bicycle"}

// Request es una ruta de orig a dest. Exclude son polígonos ([lng, lat], anillo cerrado) que la ruta no
// puede atravesar: así se esquivan los cortes de la DGT.
type Request struct {
	Orig, Dest geo.Point
	Mode       Mode
	Exclude    [][]geo.Point
}

// Maneuver es una indicación: «Gire a la derecha en Calle de Atocha».
type Maneuver struct {
	Type        string    `json:"type"` // ver maneuverTypes
	Instruction string    `json:"instruction"`
	Street      string    `json:"street"`
	DistanceM   int       `json:"distanceM"` // hasta la siguiente maniobra
	DurationS   int       `json:"durationS"`
	Position    geo.Point `json:"position"` // dónde se hace la maniobra
	BeginIndex  int       `json:"beginIndex"`
}

// Route es una ruta calculada. DurationS es sin tráfico en vivo (velocidades de OSM por tipo de vía).
type Route struct {
	DistanceM   float64
	DurationS   float64
	Coordinates []geo.Point
	Maneuvers   []Maneuver
}

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{BaseURL: baseURL, HTTP: &http.Client{Timeout: 15 * time.Second}}
}

// Route pide la ruta a Valhalla. Reintenta una vez si el motor no responde (la petición es idempotente).
func (c *Client) Route(ctx context.Context, req Request) (Route, error) {
	body, err := json.Marshal(buildRequest(req))
	if err != nil {
		return Route{}, err
	}

	var lastErr error

	for attempt := range 2 {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return Route{}, lastErr
			case <-time.After(500 * time.Millisecond):
			}
		}

		route, transient, err := c.try(ctx, body)
		if err == nil {
			return route, nil
		}

		lastErr = err
		if !transient {
			break
		}
	}

	return Route{}, lastErr
}

func (c *Client) try(ctx context.Context, body []byte) (Route, bool, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/route", bytes.NewReader(body))
	if err != nil {
		return Route{}, false, err
	}

	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.HTTP.Do(httpReq)
	if err != nil {
		return Route{}, true, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return Route{}, true, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}

	switch {
	case res.StatusCode == http.StatusOK:
		route, err := parseResponse(raw)

		return route, false, err
	case res.StatusCode >= 500 || res.StatusCode == http.StatusTooManyRequests:
		return Route{}, true, fmt.Errorf("%w: HTTP %d", ErrUnavailable, res.StatusCode)
	default:
		// 400 con error_code: 171 (sin vías cerca del punto), 442/443 (sin camino posible)…
		var e struct {
			Code int `json:"error_code"`
		}

		_ = json.Unmarshal(raw, &e)

		return Route{}, false, fmt.Errorf("%w (valhalla error %d)", ErrNotFound, e.Code)
	}
}

type valhallaLocation struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

func buildRequest(req Request) map[string]any {
	body := map[string]any{
		"locations": []valhallaLocation{{Lat: req.Orig[1], Lon: req.Orig[0]}, {Lat: req.Dest[1], Lon: req.Dest[0]}},
		"costing":   costing[req.Mode],
		"directions_options": map[string]any{
			"language": "es-ES",
			"units":    "kilometers",
		},
	}

	if req.Mode == ModeBike {
		// Bici urbana (tipo BiciMAD): acepta asfalto y algo de tierra, prefiere carriles bici.
		body["costing_options"] = map[string]any{"bicycle": map[string]any{"bicycle_type": "Hybrid"}}
	}

	if len(req.Exclude) > 0 {
		body["exclude_polygons"] = req.Exclude
	}

	return body
}

func parseResponse(raw []byte) (Route, error) {
	var resp struct {
		Trip struct {
			Legs []struct {
				Shape     string `json:"shape"`
				Maneuvers []struct {
					Type        int      `json:"type"`
					Instruction string   `json:"instruction"`
					StreetNames []string `json:"street_names"`
					Length      float64  `json:"length"` // km
					Time        float64  `json:"time"`   // s
					BeginShape  int      `json:"begin_shape_index"`
				} `json:"maneuvers"`
			} `json:"legs"`
			Summary struct {
				Length float64 `json:"length"` // km
				Time   float64 `json:"time"`   // s
			} `json:"summary"`
		} `json:"trip"`
	}

	if err := json.Unmarshal(raw, &resp); err != nil {
		return Route{}, fmt.Errorf("%w: bad response: %w", ErrUnavailable, err)
	}

	if len(resp.Trip.Legs) == 0 {
		return Route{}, ErrNotFound
	}

	route := Route{DistanceM: resp.Trip.Summary.Length * 1000, DurationS: resp.Trip.Summary.Time}

	for _, leg := range resp.Trip.Legs {
		offset := len(route.Coordinates)

		coords, err := geo.DecodePolyline(leg.Shape, 6)
		if err != nil {
			return Route{}, fmt.Errorf("%w: bad shape: %w", ErrUnavailable, err)
		}

		route.Coordinates = append(route.Coordinates, coords...)

		for _, m := range leg.Maneuvers {
			idx := min(max(m.BeginShape, 0), len(coords)-1)
			mv := Maneuver{
				Type:        maneuverType(m.Type),
				Instruction: m.Instruction,
				DistanceM:   int(math.Round(m.Length * 1000)),
				DurationS:   int(math.Round(m.Time)),
				Position:    coords[idx],
				BeginIndex:  offset + idx,
			}

			if len(m.StreetNames) > 0 {
				mv.Street = m.StreetNames[0]
			}

			route.Maneuvers = append(route.Maneuvers, mv)
		}
	}

	if len(route.Coordinates) < 2 {
		return Route{}, ErrNotFound
	}

	return route, nil
}

// maneuverTypes traduce los tipos numéricos de Valhalla a nombres estables para la web (icono por tipo).
var maneuverTypes = map[int]string{
	1: "start", 2: "start", 3: "start",
	4: "arrive", 5: "arrive", 6: "arrive",
	7: "straight", 8: "straight", 22: "straight", 17: "straight",
	9: "slight-right", 23: "slight-right",
	10: "right", 18: "slight-right", 20: "exit-right",
	11: "sharp-right",
	12: "u-turn", 13: "u-turn",
	14: "sharp-left",
	15: "left", 19: "slight-left", 21: "exit-left",
	16: "slight-left", 24: "slight-left",
	25: "merge", 37: "merge", 38: "merge",
	26: "roundabout", 27: "roundabout-exit",
	28: "ferry", 29: "ferry",
}

func maneuverType(t int) string {
	if s, ok := maneuverTypes[t]; ok {
		return s
	}

	return "straight"
}
