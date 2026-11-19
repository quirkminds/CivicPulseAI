package sources

import (
	"math"
	"testing"
)

// Los fragmentos vienen de respuestas reales (2026-11-19), recortados.

func TestDecodePolyline(t *testing.T) {
	// Primer tramo de la ruta Sol → Campus Sur de CartoCiudad.
	pts, err := decodePolyline("g|tuFxkrUGqAAE")
	if err != nil {
		t.Fatal(err)
	}

	if len(pts) != 3 {
		t.Fatalf("got %d points, want 3", len(pts))
	}

	if math.Abs(pts[0][0]-(-3.70381)) > 1e-6 || math.Abs(pts[0][1]-40.41684) > 1e-6 {
		t.Fatalf("first point = %v, want [-3.70381 40.41684] (lng, lat)", pts[0])
	}

	if _, err := decodePolyline("g|tuFxkr"); err == nil {
		t.Fatal("expected an error for a truncated polyline")
	}
}

func TestParseCartociudadRoute(t *testing.T) {
	r, err := parseCartociudadRoute([]byte(`{"found":"true","distance":"8162.43","time":"703754","geom":"g|tuFxkrUGqAAE"}`))
	if err != nil {
		t.Fatal(err)
	}

	if r.DistanceM != 8162.43 || math.Round(r.DurationS) != 704 || len(r.Coordinates) != 3 {
		t.Fatalf("unexpected route %+v", r)
	}

	if _, err := parseCartociudadRoute([]byte(`{"found":"false"}`)); err != ErrNotFound {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestVehicleValid(t *testing.T) {
	// CartoCiudad responde 200 con la ruta a pie a cualquier valor desconocido: hay que rechazarlo antes.
	for v, want := range map[Vehicle]bool{VehicleCar: true, VehicleWalk: true, "BUS": false, "": false} {
		if v.Valid() != want {
			t.Errorf("Vehicle(%q).Valid() = %v, want %v", v, !want, want)
		}
	}
}

func TestParseMadridCameras(t *testing.T) {
	kml := `<kml xmlns="http://earth.google.com/kml/2.2"><Document><Placemark>
      <description>&lt;div align=center&gt;&lt;img src=https://informo.madrid.es/cameras/Camara06303.jpg?v=53702  width=300/&gt;&lt;/div&gt;</description>
      <ExtendedData><Data name="Numero"><Value>06303</Value></Data><Data name="Nombre"><Value>PLAZA DE CASTILLA (NORTE)</Value></Data></ExtendedData>
      <Point><coordinates>-3.68894207537291,40.466063829633,10 </coordinates></Point>
    </Placemark></Document></kml>`

	cams, err := parseMadridCameras([]byte(kml))
	if err != nil {
		t.Fatal(err)
	}

	want := Camera{ID: "madrid-06303", Name: "PLAZA DE CASTILLA (NORTE)", Source: "madrid",
		ImageURL: "https://informo.madrid.es/cameras/Camara06303.jpg"}
	if len(cams) != 1 || cams[0].ID != want.ID || cams[0].Name != want.Name || cams[0].ImageURL != want.ImageURL {
		t.Fatalf("got %+v, want %+v", cams, want)
	}

	if math.Abs(cams[0].Point[0]-(-3.688942)) > 1e-5 {
		t.Fatalf("point = %v, want lng first", cams[0].Point)
	}
}

func TestParseDGTCameras(t *testing.T) {
	xml := `<d2:payload xmlns:d2="d" xmlns:ns2="f" xmlns:loc="l" xmlns:fse="x"><ns2:device id="176130">
      <ns2:typeOfDevice>camera</ns2:typeOfDevice>
      <ns2:pointLocation>
        <loc:supplementaryPositionalDescription><loc:roadInformation>
          <loc:roadDestination>BURGOS</loc:roadDestination><loc:roadName>A-62</loc:roadName>
        </loc:roadInformation></loc:supplementaryPositionalDescription>
        <loc:tpegPointLocation><loc:point><loc:pointCoordinates>
          <loc:latitude>42.2624</loc:latitude><loc:longitude>-3.9403</loc:longitude>
        </loc:pointCoordinates></loc:point></loc:tpegPointLocation>
      </ns2:pointLocation>
      <fse:deviceUrl>https://etraffic.dgt.es/camarasEtraffic/176130.jpg</fse:deviceUrl>
    </ns2:device></d2:payload>`

	cams, err := parseDGTCameras([]byte(xml))
	if err != nil {
		t.Fatal(err)
	}

	if len(cams) != 1 || cams[0].ID != "dgt-176130" || cams[0].Name != "A-62 (dir. BURGOS)" ||
		cams[0].Point != [2]float64{-3.9403, 42.2624} || cams[0].ImageURL == "" {
		t.Fatalf("unexpected cameras %+v", cams)
	}
}

func TestParseDGTIncidents(t *testing.T) {
	xml := `<d2:payload xmlns:d2="d" xmlns:sit="s" xmlns:loc="l" xmlns:lse="e" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <sit:situation><sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="18811074">
        <sit:cause><sit:causeType>roadMaintenance</sit:causeType></sit:cause>
        <sit:locationReference>
          <loc:supplementaryPositionalDescription><loc:roadInformation><loc:roadName>N-400</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription>
          <loc:tpegLinearLocation>
            <loc:to><loc:pointCoordinates><loc:latitude>39.994446</loc:latitude><loc:longitude>-3.6054852</loc:longitude></loc:pointCoordinates>
              <loc:_tpegNonJunctionPointExtension><loc:extendedTpegNonJunctionPoint><lse:province>Toledo</lse:province></loc:extendedTpegNonJunctionPoint></loc:_tpegNonJunctionPointExtension></loc:to>
            <loc:from><loc:pointCoordinates><loc:latitude>39.993732</loc:latitude><loc:longitude>-3.6074991</loc:longitude></loc:pointCoordinates></loc:from>
          </loc:tpegLinearLocation>
        </sit:locationReference>
      </sit:situationRecord></sit:situation></d2:payload>`

	inc, err := parseDGTIncidents([]byte(xml))
	if err != nil {
		t.Fatal(err)
	}

	if len(inc) != 1 {
		t.Fatalf("got %d incidents, want 1", len(inc))
	}

	got := inc[0]
	if got.Kind != "RoadOrCarriagewayOrLaneManagement" || got.Cause != "roadMaintenance" || got.Road != "N-400" ||
		got.Province != "Toledo" || got.From[0] != -3.6074991 || got.To[1] != 39.994446 {
		t.Fatalf("unexpected incident %+v", got)
	}
}

func TestParseFuelStations(t *testing.T) {
	body := `{"Fecha":"19/11/2026 14:56:20","ResultadoConsulta":"OK","ListaEESSPrecio":[
      {"IDEESS":"15493","Rótulo":"PLENERGY","Dirección":"CAMINO TORREJON, 4","Localidad":"AJALVIR","Horario":"L-D: 24H",
       "Latitud":"40,528778","Longitud (WGS84)":"-3,481639","Precio Gasolina 95 E5":"1,499","Precio Gasoleo A":""},
      {"IDEESS":"1","Latitud":"","Longitud (WGS84)":""}]}`

	st, err := parseFuelStations([]byte(body))
	if err != nil {
		t.Fatal(err)
	}

	if len(st) != 1 {
		t.Fatalf("got %d stations, want 1 (the one without coordinates is skipped)", len(st))
	}

	s := st[0]
	if s.Point != [2]float64{-3.481639, 40.528778} || s.Prices[FuelGasoline95] != 1.499 {
		t.Fatalf("unexpected station %+v", s)
	}

	if _, ok := s.Prices[FuelDiesel]; ok {
		t.Fatal("an empty price must mean no data, not 0")
	}
}

func TestParsePVPC(t *testing.T) {
	body := `{"included":[
      {"type":"Precio mercado spot","attributes":{"values":[{"value":10.01,"datetime":"2026-11-19T00:00:00.000+01:00"}]}},
      {"type":"PVPC","attributes":{"values":[{"value":92.49,"datetime":"2026-11-19T00:00:00.000+01:00"},{"value":80.1,"datetime":"2026-11-19T01:00:00.000+01:00"}]}}]}`

	prices, err := parsePVPC([]byte(body))
	if err != nil {
		t.Fatal(err)
	}

	if len(prices) != 2 || prices[0].EURPerMWh != 92.49 || prices[1].Start.Hour() != 1 {
		t.Fatalf("unexpected prices %+v", prices)
	}
}
