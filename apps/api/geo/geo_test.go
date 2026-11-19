package geo

import (
	"math"
	"testing"
)

func TestDistanceM(t *testing.T) {
	// Puerta del Sol → Campus Sur (UPM): ~7,1 km en línea recta.
	got := DistanceM(Point{-3.7038, 40.4168}, Point{-3.6283, 40.3896})
	if got < 7000 || got > 7200 {
		t.Fatalf("DistanceM = %.0f m, want ~7100", got)
	}
}

func TestDistanceToLineM(t *testing.T) {
	line := []Point{{-3.70, 40.40}, {-3.60, 40.40}}

	tests := []struct {
		name string
		p    Point
		want float64
	}{
		{"sobre la línea", Point{-3.65, 40.40}, 0},
		{"a ~111 m al norte", Point{-3.65, 40.401}, 111},
		{"más allá del extremo", Point{-3.59, 40.40}, DistanceM(Point{-3.59, 40.40}, Point{-3.60, 40.40})},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DistanceToLineM(tt.p, line); math.Abs(got-tt.want) > 2 {
				t.Fatalf("got %.1f m, want %.1f m", got, tt.want)
			}
		})
	}
}

func TestDecodePolyline(t *testing.T) {
	// Primer tramo de la ruta Sol → Campus Sur de CartoCiudad.
	pts, err := DecodePolyline("g|tuFxkrUGqAAE", 5)
	if err != nil {
		t.Fatal(err)
	}

	if len(pts) != 3 {
		t.Fatalf("got %d points, want 3", len(pts))
	}

	if math.Abs(pts[0][0]-(-3.70381)) > 1e-6 || math.Abs(pts[0][1]-40.41684) > 1e-6 {
		t.Fatalf("first point = %v, want [-3.70381 40.41684] (lng, lat)", pts[0])
	}

	if _, err := DecodePolyline("g|tuFxkr", 5); err == nil {
		t.Fatal("expected an error for a truncated polyline")
	}
}

func TestDecodePolylinePrecision6(t *testing.T) {
	// Valhalla codifica con 6 decimales: "_izlhA~rlgdF" = (38.5, -120.2).
	pts, err := DecodePolyline("_izlhA~rlgdF", 6)
	if err != nil || len(pts) != 1 || pts[0][0] != -120.2 || pts[0][1] != 38.5 {
		t.Fatalf("got %v %v", pts, err)
	}
}
