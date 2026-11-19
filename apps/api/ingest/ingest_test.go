package ingest

import "testing"

func TestParseCameraFixture(t *testing.T) {
	cameras, err := parseCameraFixture(madridCamerasFallback)
	if err != nil {
		t.Fatal(err)
	}

	if len(cameras) != 357 {
		t.Fatalf("got %d cameras, want 357", len(cameras))
	}

	c := cameras[0]
	if c.ID != "madrid-06303" || c.Source != "madrid" || c.ImageURL == "" || c.Point[0] > -3 || c.Point[1] < 40 {
		t.Fatalf("unexpected first camera: %+v", c)
	}
}
