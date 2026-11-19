package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"civicpulse/api/geo"
)

// API REST de precios de carburantes del Ministerio. Ayuda:
// https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/help
const fuelProvinceURL = "https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/"

// ProvinceMadrid es el IDProvincia de Madrid en la API de carburantes.
const ProvinceMadrid = "28"

// Fuel es el producto, con el nombre de campo que usa la API ("Precio <Fuel>").
type Fuel string

const (
	FuelGasoline95 Fuel = "Gasolina 95 E5"
	FuelDiesel     Fuel = "Gasoleo A"
)

// Station es una gasolinera con sus precios en €/l.
type Station struct {
	ID        string
	Brand     string
	Address   string
	Town      string
	Schedule  string
	Point     geo.Point
	Prices    map[Fuel]float64
	UpdatedAt string // "19/11/2026 14:56:20", hora peninsular
}

// FuelStations devuelve las gasolineras de una provincia con sus precios del día.
func (c *Client) FuelStations(ctx context.Context, provinceID string) ([]Station, error) {
	body, err := c.get(ctx, fuelProvinceURL+provinceID, 30*time.Second)
	if err != nil {
		return nil, err
	}

	return parseFuelStations(body)
}

func parseFuelStations(body []byte) ([]Station, error) {
	var raw struct {
		Fecha     string              `json:"Fecha"`
		Resultado string              `json:"ResultadoConsulta"`
		List      []map[string]string `json:"ListaEESSPrecio"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	if raw.Resultado != "OK" {
		return nil, fmt.Errorf("%w: ResultadoConsulta=%q", ErrBadResponse, raw.Resultado)
	}

	stations := make([]Station, 0, len(raw.List))

	for _, s := range raw.List {
		lat, ok1 := spanishFloat(s["Latitud"])
		lng, ok2 := spanishFloat(s["Longitud (WGS84)"])

		if !ok1 || !ok2 {
			continue
		}

		prices := map[Fuel]float64{}

		for _, f := range []Fuel{FuelGasoline95, FuelDiesel} {
			if p, ok := spanishFloat(s["Precio "+string(f)]); ok {
				prices[f] = p
			}
		}

		stations = append(stations, Station{
			ID: s["IDEESS"], Brand: s["Rótulo"], Address: s["Dirección"], Town: s["Localidad"], Schedule: s["Horario"],
			Point: geo.Point{lng, lat}, Prices: prices, UpdatedAt: raw.Fecha,
		})
	}

	return stations, nil
}

// spanishFloat lee números con coma decimal ("1,499"). Vacío = sin dato.
func spanishFloat(s string) (float64, bool) {
	if s = strings.TrimSpace(s); s == "" {
		return 0, false
	}

	v, err := strconv.ParseFloat(strings.Replace(s, ",", ".", 1), 64)

	return v, err == nil
}
