package sources

import (
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"civicpulse/api/geo"
)

const dgtIncidentsURL = "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml"

// Incident es una incidencia de tráfico de la DGT: obras, retenciones, accidentes, cortes…
type Incident struct {
	ID       string
	Kind     string // tipo DATEX II: "RoadOrCarriagewayOrLaneManagement", "AbnormalTraffic"…
	Cause    string // "roadMaintenance", "obstruction"…
	Road     string
	Province string
	From, To geo.Point // un tramo; en incidencias puntuales From == To
}

// DGTIncidents lee las incidencias activas de la DGT (DATEX II v3.7).
func (c *Client) DGTIncidents(ctx context.Context) ([]Incident, error) {
	body, err := c.get(ctx, dgtIncidentsURL, 30*time.Second)
	if err != nil {
		return nil, err
	}

	return parseDGTIncidents(body)
}

type datexPoint struct {
	Lat      float64 `xml:"pointCoordinates>latitude"`
	Lng      float64 `xml:"pointCoordinates>longitude"`
	Province string  `xml:"_tpegNonJunctionPointExtension>extendedTpegNonJunctionPoint>province"`
}

func (p datexPoint) empty() bool { return p.Lat == 0 && p.Lng == 0 }

func parseDGTIncidents(body []byte) ([]Incident, error) {
	var doc struct {
		Records []struct {
			ID     string     `xml:"id,attr"`
			Type   string     `xml:"type,attr"`
			Cause  string     `xml:"cause>causeType"`
			Road   string     `xml:"locationReference>supplementaryPositionalDescription>roadInformation>roadName"`
			From   datexPoint `xml:"locationReference>tpegLinearLocation>from"`
			To     datexPoint `xml:"locationReference>tpegLinearLocation>to"`
			Single datexPoint `xml:"locationReference>tpegPointLocation>point"`
		} `xml:"situation>situationRecord"`
	}

	if err := xml.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	incidents := make([]Incident, 0, len(doc.Records))

	for _, r := range doc.Records {
		from, to := r.From, r.To

		switch {
		case from.empty() && to.empty():
			from, to = r.Single, r.Single
		case from.empty():
			from = to
		case to.empty():
			to = from
		}

		if from.empty() {
			continue
		}

		province := to.Province
		if province == "" {
			province = from.Province
		}

		// xsi:type llega con prefijo de espacio de nombres ("sit:AbnormalTraffic").
		_, kind, found := strings.Cut(r.Type, ":")
		if !found {
			kind = r.Type
		}

		incidents = append(incidents, Incident{
			ID: r.ID, Kind: kind, Cause: r.Cause, Road: r.Road, Province: province,
			From: geo.Point{from.Lng, from.Lat}, To: geo.Point{to.Lng, to.Lat},
		})
	}

	return incidents, nil
}
