package sources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// ESIOS (Red Eléctrica): https://api.esios.ree.es. Indicadores de demanda, generación por tecnología,
// CO₂ y precios. Los de «tiempo real» son cada 5 minutos con unos 8 minutos de retraso.
const esiosIndicatorURL = "https://api.esios.ree.es/indicators/"

// Zonas de ESIOS que usamos.
const (
	GeoPeninsula = 8741
	GeoSpain     = 3 // precio del mercado diario (OMIE) para España
)

// ErrNoToken: no hay clave de ESIOS configurada.
var ErrNoToken = errors.New("ESIOS token not configured")

// ESIOSValue es un valor de un indicador en un instante (inicio del intervalo).
type ESIOSValue struct {
	Time  time.Time
	Value float64
}

// ESIOSIndicator devuelve los valores de un indicador entre start y end para una zona.
// hourly = true pide a ESIOS la media por hora (time_trunc=hour, time_agg=average).
func (c *Client) ESIOSIndicator(ctx context.Context, id int, start, end time.Time, geoID int, hourly bool) ([]ESIOSValue, error) {
	if c.ESIOSToken == "" {
		return nil, ErrNoToken
	}

	q := url.Values{
		"start_date": {start.Format(time.RFC3339)},
		"end_date":   {end.Format(time.RFC3339)},
	}
	if hourly {
		q.Set("time_trunc", "hour")
		q.Set("time_agg", "average")
	}

	header := http.Header{
		"Accept":    {"application/json; application/vnd.esios-api-v1+json"},
		"X-Api-Key": {c.ESIOSToken},
	}

	body, err := c.getWithHeader(ctx, esiosIndicatorURL+strconv.Itoa(id)+"?"+q.Encode(), header, 20*time.Second)
	if err != nil {
		return nil, err
	}

	return parseESIOS(body, geoID)
}

func parseESIOS(body []byte, geoID int) ([]ESIOSValue, error) {
	var raw struct {
		Indicator struct {
			Values []struct {
				Value    float64 `json:"value"`
				Datetime string  `json:"datetime"`
				GeoID    int     `json:"geo_id"`
			} `json:"values"`
		} `json:"indicator"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	out := make([]ESIOSValue, 0, len(raw.Indicator.Values))

	for _, v := range raw.Indicator.Values {
		if v.GeoID != geoID {
			continue
		}

		t, err := time.Parse(time.RFC3339, v.Datetime)
		if err != nil {
			return nil, fmt.Errorf("%w: datetime %q", ErrBadResponse, v.Datetime)
		}

		out = append(out, ESIOSValue{Time: t, Value: v.Value})
	}

	return out, nil
}
