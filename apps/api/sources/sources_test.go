package sources

import (
	"math"
	"testing"
)

// Los fragmentos vienen de respuestas reales (2026-11-19), recortados.

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

func TestParseDGTIncidentDetails(t *testing.T) {
	// Fragmentos reales (19/11/2026): un corte total y un tramo con tráfico lento.
	xml := `<d2:payload xmlns:d2="d" xmlns:sit="s" xmlns:loc="l" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><sit:situation>
      <sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="1">
        <sit:cause><sit:causeType>roadMaintenance</sit:causeType></sit:cause>
        <sit:locationReference><loc:tpegLinearLocation><loc:tpegDirection>
                    unknown
                </loc:tpegDirection>
          <loc:to><loc:pointCoordinates><loc:latitude>40.1</loc:latitude><loc:longitude>-3.7</loc:longitude></loc:pointCoordinates></loc:to>
          <loc:from><loc:pointCoordinates><loc:latitude>40.2</loc:latitude><loc:longitude>-3.6</loc:longitude></loc:pointCoordinates></loc:from>
        </loc:tpegLinearLocation></sit:locationReference>
        <sit:roadOrCarriagewayOrLaneManagementType>
            roadClosed
        </sit:roadOrCarriagewayOrLaneManagementType>
      </sit:situationRecord>
      <sit:situationRecord xsi:type="sit:AbnormalTraffic" id="2">
        <sit:cause><sit:causeType>abnormalTraffic</sit:causeType></sit:cause>
        <sit:locationReference><loc:tpegPointLocation><loc:point><loc:pointCoordinates><loc:latitude>40.3</loc:latitude><loc:longitude>-3.5</loc:longitude></loc:pointCoordinates></loc:point></loc:tpegPointLocation></sit:locationReference>
        <sit:abnormalTrafficType>slowTraffic</sit:abnormalTrafficType>
      </sit:situationRecord></sit:situation></d2:payload>`

	inc, err := parseDGTIncidents([]byte(xml))
	if err != nil {
		t.Fatal(err)
	}

	if len(inc) != 2 || !inc[0].Closed() || inc[0].Direction != "unknown" || inc[1].Closed() || inc[1].Abnormal != "slowTraffic" {
		t.Fatalf("unexpected incidents %+v", inc)
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

func TestParseESIOS(t *testing.T) {
	// Fragmento real de /indicators/600 (mercado diario, 19/11/2026): una fila por país.
	body := []byte(`{"indicator":{"id":600,"short_name":"Mercado SPOT","values":[
		{"value":7.12,"datetime":"2026-11-19T00:00:00.000+01:00","datetime_utc":"2026-11-18T23:00:00Z","geo_id":3,"geo_name":"España"},
		{"value":91.3,"datetime":"2026-11-19T00:00:00.000+01:00","datetime_utc":"2026-11-18T23:00:00Z","geo_id":2,"geo_name":"Francia"},
		{"value":5.01,"datetime":"2026-11-19T01:00:00.000+01:00","datetime_utc":"2026-11-19T00:00:00Z","geo_id":3,"geo_name":"España"}]}}`)

	got, err := parseESIOS(body, GeoSpain)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 2 || got[0].Value != 7.12 || got[1].Time.UTC().Hour() != 0 || got[1].Time.Hour() != 1 {
		t.Fatalf("got %+v", got)
	}
}
