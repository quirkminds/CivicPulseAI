// Package geo tiene las medidas mínimas para cruzar puntos con rutas sin depender de la base de datos.
// Cuando los datos vivan en PostGIS, las consultas usarán ST_DWithin; esto queda para el probe y los tests.
package geo

import "math"

// Point es [lng, lat] en WGS84, el mismo orden que GeoJSON.
type Point [2]float64

const earthRadiusM = 6_371_008.8

// DistanceM es la distancia de haversine entre dos puntos, en metros.
func DistanceM(a, b Point) float64 {
	lat1, lat2 := rad(a[1]), rad(b[1])
	dLat, dLng := lat2-lat1, rad(b[0]-a[0])
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLng/2)*math.Sin(dLng/2)

	return 2 * earthRadiusM * math.Asin(math.Sqrt(h))
}

// DistanceToLineM es la distancia mínima de p a la polilínea, en metros. Proyecta localmente
// (equirectangular): el error es despreciable a escala urbana, que es para lo que se usa.
func DistanceToLineM(p Point, line []Point) float64 {
	if len(line) == 0 {
		return math.Inf(1)
	}

	if len(line) == 1 {
		return DistanceM(p, line[0])
	}

	kx := earthRadiusM * math.Cos(rad(p[1])) * math.Pi / 180
	ky := earthRadiusM * math.Pi / 180
	best := math.Inf(1)

	for i := 1; i < len(line); i++ {
		ax, ay := (line[i-1][0]-p[0])*kx, (line[i-1][1]-p[1])*ky
		bx, by := (line[i][0]-p[0])*kx, (line[i][1]-p[1])*ky
		best = math.Min(best, distanceToSegment(ax, ay, bx, by))
	}

	return best
}

// distanceToSegment mide desde el origen (el punto) hasta el segmento AB en un plano local, en metros.
func distanceToSegment(ax, ay, bx, by float64) float64 {
	dx, dy := bx-ax, by-ay
	lengthSq := dx*dx + dy*dy

	t := 0.0
	if lengthSq > 0 {
		t = math.Max(0, math.Min(1, -(ax*dx+ay*dy)/lengthSq))
	}

	return math.Hypot(ax+t*dx, ay+t*dy)
}

func rad(deg float64) float64 { return deg * math.Pi / 180 }
