package geo

import (
	"errors"
	"math"
)

// DecodePolyline decodifica el formato comprimido de Google (pares lat,lng) a puntos [lng, lat].
// precision es el número de decimales: 5 en CartoCiudad, 6 en Valhalla.
func DecodePolyline(s string, precision int) ([]Point, error) {
	factor := math.Pow10(precision)

	var (
		points   []Point
		lat, lng int
	)

	for i := 0; i < len(s); {
		var deltas [2]int

		for k := range deltas {
			result, shift := 0, 0

			for {
				if i >= len(s) {
					return nil, errors.New("truncated polyline")
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
		points = append(points, Point{float64(lng) / factor, float64(lat) / factor})
	}

	return points, nil
}
