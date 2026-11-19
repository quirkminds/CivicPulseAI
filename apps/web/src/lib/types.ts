import type { Feature, FeatureCollection, LineString, Point } from "geojson";

export type LngLat = [number, number];

/** Contrato de `GET /api/route` (la API en Go envuelve CartoCiudad y devuelve GeoJSON). */
export type Route = {
  provider: "cartociudad";
  distanceM: number;
  /** Duración de CartoCiudad (velocidades fijas, sin tráfico). */
  durationS: number;
  geometry: LineString;
};

export type CameraSource = "madrid" | "dgt";

export type CameraProps = {
  id: string;
  name: string;
  source: CameraSource;
  imageUrl: string | null;
};

export type Camera = Feature<Point, CameraProps>;
export type CameraCollection = FeatureCollection<Point, CameraProps>;

/** Cámara situada sobre la ruta, con su posición a lo largo del trayecto. */
export type CameraOnRoute = Camera & {
  properties: CameraProps & {
    /** Distancia perpendicular a la ruta, en metros. */
    offsetM: number;
    /** Distancia recorrida desde el origen hasta la cámara, en metros. */
    alongM: number;
  };
};

export type Campus = {
  id: string;
  name: string;
  school: string;
  coords: LngLat;
};
