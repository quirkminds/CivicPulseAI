// Package sources descarga y traduce las fuentes oficiales a tipos propios. No sabe nada de HTTP
// entrante ni de la base de datos: lo usan el probe, la ingesta y los handlers.
// El detalle de cada fuente está en docs/fuentes-de-datos.md.
package sources

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Errores propios: nunca se propaga el texto del proveedor.
var (
	ErrUnavailable = errors.New("source unavailable")
	ErrBadResponse = errors.New("source returned an unexpected response")
	ErrNotFound    = errors.New("source found nothing")
)

// Client hace las peticiones salientes. Cada llamada tiene su propio límite de tiempo.
type Client struct {
	HTTP *http.Client
	// ESIOSToken es la clave de api.esios.ree.es. Vacía = ESIOS no disponible (se usa REData).
	// Va solo en la cabecera x-api-key: nunca en la URL, en logs ni en errores.
	ESIOSToken string
}

func NewClient() *Client {
	return &Client{HTTP: &http.Client{Timeout: 60 * time.Second}}
}

// get descarga url con un límite de tiempo. Reintenta una vez los fallos transitorios (red, 5xx, 429):
// todas las peticiones a fuentes son GET idempotentes.
func (c *Client) get(ctx context.Context, url string, budget time.Duration) ([]byte, error) {
	return c.getWithHeader(ctx, url, nil, budget)
}

// getWithHeader es get con cabeceras extra (p. ej. la clave de una API).
func (c *Client) getWithHeader(ctx context.Context, url string, header http.Header, budget time.Duration) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	var lastErr error

	for attempt := range 2 {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("%w: %w", ErrUnavailable, lastErr)
			case <-time.After(time.Second):
			}
		}

		body, transient, err := c.try(ctx, url, header)
		if err == nil {
			return body, nil
		}

		lastErr = err
		if !transient {
			break
		}
	}

	return nil, lastErr
}

func (c *Client) try(ctx context.Context, url string, header http.Header) (body []byte, transient bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, false, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	for k, v := range header {
		req.Header[k] = v
	}

	// Identificación genérica del cliente, sin datos del equipo.
	req.Header.Set("User-Agent", "CivicPulse/0.1 (open-data hackathon MVP)")

	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	defer res.Body.Close()

	if res.StatusCode >= 500 || res.StatusCode == http.StatusTooManyRequests {
		return nil, true, fmt.Errorf("%w: HTTP %d", ErrUnavailable, res.StatusCode)
	}

	if res.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("%w: HTTP %d", ErrBadResponse, res.StatusCode)
	}

	body, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, true, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}

	return body, false, nil
}
