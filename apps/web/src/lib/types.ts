import type { Feature, FeatureCollection, LineString, MultiPolygon, Point } from "geojson";

export type LngLat = [number, number];

/** Medio de transporte con ruta propia (`mode` en `GET /v1/trip`). */
export type TravelMode = "car" | "walk" | "bike";

/** Tipo de maniobra (`Maneuver.type` en openapi.yaml): decide el icono. */
export type ManeuverType =
  | "start"
  | "arrive"
  | "straight"
  | "slight-right"
  | "right"
  | "sharp-right"
  | "u-turn"
  | "sharp-left"
  | "left"
  | "slight-left"
  | "exit-right"
  | "exit-left"
  | "merge"
  | "roundabout"
  | "roundabout-exit"
  | "ferry";

/** Indicación paso a paso (`Maneuver` en openapi.yaml). */
export type Maneuver = {
  type: ManeuverType;
  instruction: string;
  street: string;
  /** Metros hasta la siguiente maniobra. */
  distanceM: number;
  durationS: number;
  position: LngLat;
  beginIndex: number;
};

/** Ruta tal como la devuelve la API (`Route` en openapi.yaml). */
export type Route = {
  /** `cartociudad` es el respaldo: sin sentidos únicos ni indicaciones. */
  engine: "valhalla" | "cartociudad";
  mode: TravelMode;
  distanceM: number;
  /** Sin tráfico en vivo: velocidades por tipo de vía. */
  durationS: number;
  /** durationS + retraso estimado por los avisos de tráfico lento de la DGT. */
  trafficDurationS: number;
  geometry: LineString;
  maneuvers: Maneuver[];
};

/** Corte de vía de la DGT (`TrafficSpot` en openapi.yaml). */
export type TrafficSpot = { id: string; road: string; position: LngLat };

/** Tramo con tráfico lento según la DGT (`SlowSegment` en openapi.yaml). */
export type SlowSegment = {
  id: string;
  road: string;
  type: "slowTraffic" | "heavyTraffic" | "queuingTraffic" | "stationaryTraffic";
  lengthM: number;
  /** Retraso estimado en segundos. */
  delayS: number;
  position: LngLat;
};

/** Cómo afecta el tráfico de la DGT a la ruta (`Traffic` en openapi.yaml). Solo en coche. */
export type TripTraffic = {
  closuresAvoided: TrafficSpot[];
  closuresOnRoute: TrafficSpot[];
  slowSegments: SlowSegment[];
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

/** Gasolinera a ≤1 km de la ruta (`Station` en openapi.yaml). */
export type Station = {
  id: string;
  brand: string;
  address: string;
  position: LngLat;
  /** €/l del combustible pedido. */
  price: number;
  distanceM: number;
};

/** Incidencia de la DGT a ≤500 m de la ruta (`Incident` en openapi.yaml). */
export type Incident = {
  id: string;
  kind: string;
  cause: string;
  road: string;
  position: LngLat;
  alongM: number;
};

export type Fuel = "g95" | "diesel";

/** Coste en combustible (`Cost` en openapi.yaml). */
export type CarCost = {
  fuel: Fuel;
  consumptionL100km: number;
  pricePerLiter: number;
  litersPerTrip: number;
  eurPerTrip: number;
  eurPerMonth: number;
  days: number;
};

/** Cámara tal como llega de la API (`Camera` en openapi.yaml). */
export type TripCamera = {
  id: string;
  name: string;
  source: CameraSource;
  imageUrl: string | null;
  position: LngLat;
  alongM: number;
  distanceM: number;
};

/** Respuesta de `GET /v1/trip`. Coste, gasolineras y cámaras solo en coche. */
export type Trip = {
  route: Route;
  traffic: TripTraffic;
  cost: CarCost | null;
  stations: Station[];
  cameras: TripCamera[];
  incidents: Incident[];
  /** Última ingesta correcta de cada capa; null = nunca (datos de respaldo). */
  updatedAt: Record<string, string | null>;
};

export type Campus = {
  id: string;
  name: string;
  school: string;
  coords: LngLat;
};

// ---------- «Mi casa»: red eléctrica (ESIOS) ----------

export type TechId =
  | "solar-pv"
  | "wind"
  | "hydro"
  | "solar-thermal"
  | "renewable-thermal"
  | "nuclear"
  | "combined-cycle"
  | "cogeneration"
  | "coal"
  | "fuel-gas"
  | "pumped-hydro"
  | "batteries"
  | "imports";

/** Respuesta de `GET /v1/electricity/now` (`ElectricityNow` en openapi.yaml). */
export type ElectricityNow = {
  at: string;
  demandMw: number;
  forecastMw: number | null;
  generationMw: number;
  /** % renovable de la generación. */
  renewableShare: number;
  co2GramsPerKwh: number;
  mix: { id: TechId; mw: number; share: number; renewable: boolean }[];
  flows: { exportsMw: number; pumpingMw: number; batteriesChargeMw: number; balearesMw: number };
};

export type TariffPeriod = "punta" | "llano" | "valle";

export type GenerationMix = {
  hydro: number;
  nuclear: number;
  gas: number;
  wind: number;
  solar: number;
  other: number;
  exports: number;
  pumping: number;
};

/** Una hora de hoy (`HourInfo` en openapi.yaml). Precios en €/kWh. */
export type HourInfo = {
  start: string;
  price: number;
  market: number | null;
  regulated: number | null;
  period: TariffPeriod | null;
  demandMw: number | null;
  renewableShare: number | null;
  solarShare: number | null;
  windShare: number | null;
  generation?: GenerationMix | null;
};

/** Respuesta de `GET /v1/electricity/today` (`Electricity` en openapi.yaml). */
export type ElectricityToday = {
  date: string;
  source: "esios" | "redata";
  average: number;
  hours: HourInfo[];
  cheapest: { hours: number; start: string; average: number; savingPercent: number }[];
  extremes: { cheapest: HourInfo; priciest: HourInfo } | null;
  tomorrowMarket: { start: string; market: number }[];
};


export type NeighborhoodLevel = "community" | "province" | "municipality" | "district" | "section";

export type NeighborhoodZone = {
  id: string;
  name: string;
  level: NeighborhoodLevel;
  income: number | null;
  population: number | null;
  meanAge: number | null;
  singlePersonHouseholds: number | null;
  bounds: string;
};

export type NeighborhoodZones = FeatureCollection<MultiPolygon, NeighborhoodZone> & {
  year: number;
  geographyDate: string;
};
