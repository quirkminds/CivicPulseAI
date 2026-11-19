package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

// REData (apidatos.ree.es) da el PVPC por horas sin token. ESIOS (api.esios.ree.es) pide token y se
// usará solo si hace falta algo que REData no tenga.
const reeMarketPricesURL = "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real"

// HourPrice es el precio PVPC de una hora en €/MWh.
type HourPrice struct {
	Start     time.Time
	EURPerMWh float64
}

// PVPC devuelve los precios por hora del PVPC para un día (hora peninsular).
func (c *Client) PVPC(ctx context.Context, day time.Time) ([]HourPrice, error) {
	madrid, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		return nil, err
	}

	d := day.In(madrid).Format("2006-01-02")
	q := url.Values{
		"start_date": {d + "T00:00"},
		"end_date":   {d + "T23:59"},
		"time_trunc": {"hour"},
	}

	body, err := c.get(ctx, reeMarketPricesURL+"?"+q.Encode(), 15*time.Second)
	if err != nil {
		return nil, err
	}

	return parsePVPC(body)
}

func parsePVPC(body []byte) ([]HourPrice, error) {
	var raw struct {
		Included []struct {
			Type       string `json:"type"`
			Attributes struct {
				Values []struct {
					Value    float64 `json:"value"`
					Datetime string  `json:"datetime"`
				} `json:"values"`
			} `json:"attributes"`
		} `json:"included"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	for _, inc := range raw.Included {
		if inc.Type != "PVPC" {
			continue
		}

		prices := make([]HourPrice, 0, len(inc.Attributes.Values))

		for _, v := range inc.Attributes.Values {
			start, err := time.Parse("2006-01-02T15:04:05.000-07:00", v.Datetime)
			if err != nil {
				return nil, fmt.Errorf("%w: datetime %q", ErrBadResponse, v.Datetime)
			}

			prices = append(prices, HourPrice{Start: start, EURPerMWh: v.Value})
		}

		return prices, nil
	}

	return nil, ErrNotFound
}
