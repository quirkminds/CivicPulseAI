package sources

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

const (
	renfeTripUpdatesURL = "https://gtfsrt.renfe.com/trip_updates.json"
	renfeAlertsURL      = "https://gtfsrt.renfe.com/alerts.json"
	// GTFS estático de Cercanías de toda España. Sus trip_id coinciden con los del tiempo real.
	renfeGTFSURL = "https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip"
)

// RenfeMadridRoutePrefix identifica las líneas del núcleo de Cercanías Madrid en route_id ("10T0007C3").
const RenfeMadridRoutePrefix = "10T"

// TripDelay es el retraso en vivo de un tren de Cercanías.
type TripDelay struct {
	TripID string
	DelayS int
}

// Alert es un aviso de servicio de Renfe, con las líneas (route_id) afectadas.
type Alert struct {
	ID       string
	Text     string
	RouteIDs []string
}

// RenfeTripDelays lee los retrasos en vivo (GTFS-RT en JSON) de Cercanías de toda España.
func (c *Client) RenfeTripDelays(ctx context.Context) ([]TripDelay, error) {
	body, err := c.get(ctx, renfeTripUpdatesURL, 15*time.Second)
	if err != nil {
		return nil, err
	}

	var feed struct {
		Entity []struct {
			TripUpdate *struct {
				Trip struct {
					TripID string `json:"tripId"`
				} `json:"trip"`
				Delay int `json:"delay"`
			} `json:"tripUpdate"`
		} `json:"entity"`
	}

	if err := json.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	delays := make([]TripDelay, 0, len(feed.Entity))

	for _, e := range feed.Entity {
		if e.TripUpdate != nil {
			delays = append(delays, TripDelay{TripID: e.TripUpdate.Trip.TripID, DelayS: e.TripUpdate.Delay})
		}
	}

	return delays, nil
}

// RenfeAlerts lee los avisos de servicio en vivo.
func (c *Client) RenfeAlerts(ctx context.Context) ([]Alert, error) {
	body, err := c.get(ctx, renfeAlertsURL, 15*time.Second)
	if err != nil {
		return nil, err
	}

	var feed struct {
		Entity []struct {
			ID    string `json:"id"`
			Alert *struct {
				Informed []struct {
					RouteID string `json:"routeId"`
				} `json:"informedEntity"`
				Description struct {
					Translation []struct {
						Text string `json:"text"`
					} `json:"translation"`
				} `json:"descriptionText"`
			} `json:"alert"`
		} `json:"entity"`
	}

	if err := json.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	alerts := make([]Alert, 0, len(feed.Entity))

	for _, e := range feed.Entity {
		if e.Alert == nil {
			continue
		}

		a := Alert{ID: e.ID}
		if len(e.Alert.Description.Translation) > 0 {
			a.Text = e.Alert.Description.Translation[0].Text
		}

		for _, ie := range e.Alert.Informed {
			a.RouteIDs = append(a.RouteIDs, ie.RouteID)
		}

		alerts = append(alerts, a)
	}

	return alerts, nil
}

// RenfeGTFS es lo mínimo del GTFS estático para cruzar con el tiempo real: a qué línea pertenece cada viaje.
type RenfeGTFS struct {
	TripRoute  map[string]string // trip_id → route_id
	RouteShort map[string]string // route_id → "C3"
	Stops      int
	ServiceEnd string // fecha más tardía del calendario, YYYYMMDD
}

// RenfeStaticGTFS descarga el GTFS de Cercanías (~16 MB) y lee trips, routes, stops y calendar.
// stop_times.txt (~270 MB descomprimido) no se toca.
func (c *Client) RenfeStaticGTFS(ctx context.Context) (RenfeGTFS, error) {
	body, err := c.get(ctx, renfeGTFSURL, 90*time.Second)
	if err != nil {
		return RenfeGTFS{}, err
	}

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return RenfeGTFS{}, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	g := RenfeGTFS{TripRoute: map[string]string{}, RouteShort: map[string]string{}}

	steps := []struct {
		file string
		row  func(rec map[string]string)
	}{
		{"trips.txt", func(r map[string]string) { g.TripRoute[r["trip_id"]] = r["route_id"] }},
		{"routes.txt", func(r map[string]string) { g.RouteShort[r["route_id"]] = r["route_short_name"] }},
		{"stops.txt", func(map[string]string) { g.Stops++ }},
		{"calendar.txt", func(r map[string]string) { g.ServiceEnd = max(g.ServiceEnd, r["end_date"]) }},
	}

	for _, s := range steps {
		if err := readGTFSFile(zr, s.file, s.row); err != nil {
			return RenfeGTFS{}, err
		}
	}

	return g, nil
}

// readGTFSFile recorre un CSV del zip con las cabeceras como claves. Renfe rellena con espacios: se recortan.
func readGTFSFile(zr *zip.Reader, name string, row func(map[string]string)) error {
	f, err := zr.Open(name)
	if err != nil {
		return fmt.Errorf("%w: missing %s", ErrBadResponse, name)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("%w: %s: %w", ErrBadResponse, name, err)
	}

	for i := range header {
		header[i] = strings.TrimSpace(strings.TrimPrefix(header[i], "\ufeff"))
	}

	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return nil
		}

		if err != nil {
			return fmt.Errorf("%w: %s: %w", ErrBadResponse, name, err)
		}

		m := make(map[string]string, len(header))
		for i, h := range header {
			if i < len(rec) {
				m[h] = strings.TrimSpace(rec[i])
			}
		}

		row(m)
	}
}

// IsMadrid dice si un route_id pertenece al núcleo de Cercanías Madrid.
func IsMadrid(routeID string) bool { return strings.HasPrefix(routeID, RenfeMadridRoutePrefix) }

// FormatDelay devuelve "+7 min" o "en hora".
func FormatDelay(seconds int) string {
	if seconds < 60 {
		return "en hora"
	}

	return "+" + strconv.Itoa(seconds/60) + " min"
}
