package sources

import (
	"context"
	"encoding/xml"
	"fmt"
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"

	"civicpulse/api/geo"
)

const (
	madridCamerasURL = "https://informo.madrid.es/informo/tmadrid/CCTV.kml"
	dgtCamerasURL    = "https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml"
)

// Camera es una cámara de tráfico con foto en directo, de cualquier fuente.
type Camera struct {
	ID       string // "madrid-06303", "dgt-176130"
	Name     string
	Source   string // "madrid" | "dgt"
	ImageURL string
	Point    geo.Point
}

// MadridCameras lee el KML de cámaras del Ayuntamiento (informo.madrid.es).
func (c *Client) MadridCameras(ctx context.Context) ([]Camera, error) {
	body, err := c.get(ctx, madridCamerasURL, 20*time.Second)
	if err != nil {
		return nil, err
	}

	return parseMadridCameras(body)
}

var kmlImageSrc = regexp.MustCompile(`img src=(\S+)`)

func parseMadridCameras(body []byte) ([]Camera, error) {
	var doc struct {
		Placemarks []struct {
			Description string `xml:"description"`
			Data        []struct {
				Name  string `xml:"name,attr"`
				Value string `xml:"Value"`
			} `xml:"ExtendedData>Data"`
			Coordinates string `xml:"Point>coordinates"`
		} `xml:"Document>Placemark"`
	}

	if err := xml.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	cameras := make([]Camera, 0, len(doc.Placemarks))

	for _, pm := range doc.Placemarks {
		var number, name string

		for _, d := range pm.Data {
			switch d.Name {
			case "Numero":
				number = strings.TrimSpace(d.Value)
			case "Nombre":
				name = strings.TrimSpace(d.Value)
			}
		}

		point, ok := parseKMLCoordinates(pm.Coordinates)
		if number == "" || !ok {
			continue
		}

		var image string
		if m := kmlImageSrc.FindStringSubmatch(html.UnescapeString(pm.Description)); m != nil {
			image, _, _ = strings.Cut(m[1], "?")
		}

		cameras = append(cameras, Camera{ID: "madrid-" + number, Name: name, Source: "madrid", ImageURL: image, Point: point})
	}

	return cameras, nil
}

// parseKMLCoordinates lee "lng,lat[,alt]".
func parseKMLCoordinates(s string) (geo.Point, bool) {
	parts := strings.Split(strings.TrimSpace(s), ",")
	if len(parts) < 2 {
		return geo.Point{}, false
	}

	lng, err1 := strconv.ParseFloat(parts[0], 64)
	lat, err2 := strconv.ParseFloat(parts[1], 64)

	return geo.Point{lng, lat}, err1 == nil && err2 == nil
}

// DGTCameras lee las cámaras de la DGT (DATEX II v3.7, toda España salvo País Vasco y Cataluña).
func (c *Client) DGTCameras(ctx context.Context) ([]Camera, error) {
	body, err := c.get(ctx, dgtCamerasURL, 30*time.Second)
	if err != nil {
		return nil, err
	}

	return parseDGTCameras(body)
}

func parseDGTCameras(body []byte) ([]Camera, error) {
	// encoding/xml empareja por nombre local cuando la etiqueta no lleva espacio de nombres.
	var doc struct {
		Devices []struct {
			ID    string  `xml:"id,attr"`
			Type  string  `xml:"typeOfDevice"`
			Road  string  `xml:"pointLocation>supplementaryPositionalDescription>roadInformation>roadName"`
			Dest  string  `xml:"pointLocation>supplementaryPositionalDescription>roadInformation>roadDestination"`
			Lat   float64 `xml:"pointLocation>tpegPointLocation>point>pointCoordinates>latitude"`
			Lng   float64 `xml:"pointLocation>tpegPointLocation>point>pointCoordinates>longitude"`
			Image string  `xml:"deviceUrl"`
		} `xml:"device"`
	}

	if err := xml.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrBadResponse, err)
	}

	cameras := make([]Camera, 0, len(doc.Devices))

	for _, d := range doc.Devices {
		if d.Type != "camera" || (d.Lat == 0 && d.Lng == 0) {
			continue
		}

		name := strings.TrimSpace(d.Road)
		if d.Dest != "" {
			name += " (dir. " + d.Dest + ")"
		}

		cameras = append(cameras, Camera{
			ID: "dgt-" + d.ID, Name: name, Source: "dgt", ImageURL: strings.TrimSpace(d.Image), Point: geo.Point{d.Lng, d.Lat},
		})
	}

	return cameras, nil
}
