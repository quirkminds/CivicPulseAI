package main

import (
	"context"
	"sync"
	"time"
)

// cached guarda el último valor bueno de una fuente durante ttl, por clave (p. ej. el día).
// Evita pedir a la fuente en cada petición; si la fuente falla, el error no se cachea.
type cached[T any] struct {
	ttl time.Duration

	mu    sync.Mutex
	key   string
	value T
	until time.Time
}

func (c *cached[T]) get(ctx context.Context, key string, load func(context.Context) (T, error)) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.key == key && time.Now().Before(c.until) {
		return c.value, nil
	}

	v, err := load(ctx)
	if err != nil {
		var zero T

		return zero, err
	}

	c.key, c.value, c.until = key, v, time.Now().Add(c.ttl)

	return v, nil
}
