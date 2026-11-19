import { API_URL } from "@/api-url";
import type { CameraOnRoute, ElectricityNow, ElectricityToday, LngLat, NeighborhoodZones, TravelMode, Trip, TripCamera } from "./types";

/**
 * Cliente de la API (apps/api). El contrato vive en apps/api/openapi.yaml.
 *
 * Sin `VITE_API_URL` se sirven respuestas reales de la API guardadas en `mocks/` (p. ej. `GET /v1/trip`
 * Sol → Campus Sur en cada modo). Las rutas de CartoCiudad, la DGT y el Ayuntamiento no envían cabeceras CORS, así que
 * se cruzan en la API (ver docs/fuentes-de-datos.md).
 */
export const USE_MOCKS = API_URL === undefined;

const toParam = ([lng, lat]: LngLat) => `${lat},${lng}`;

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) {
    // Los errores de la API son problem documents (RFC 9457) con un `detail` legible.
    const problem = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(problem?.detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Respuestas reales de `GET /v1/trip` (Sol → Campus Sur) por modo, para trabajar sin API. */
const TRIP_MOCKS: Record<TravelMode, () => Promise<{ default: unknown }>> = {
  car: () => import("@/mocks/trip-car-sol-campus-sur.json"),
  walk: () => import("@/mocks/trip-walk-sol-campus-sur.json"),
  bike: () => import("@/mocks/trip-bike-sol-campus-sur.json"),
};

export async function fetchTrip(orig: LngLat, dest: LngLat, mode: TravelMode, signal?: AbortSignal): Promise<Trip> {
  if (USE_MOCKS) {
    // El fixture es siempre Sol → Campus Sur, independientemente de origen y destino.
    // Cast vía unknown: el JSON importado tipa las coordenadas como number[] (no tupla) y los null como
    // tipo propio. El fichero es una respuesta real de la API guardada tal cual.
    return (await TRIP_MOCKS[mode]()).default as Trip;
  }
  const qs = new URLSearchParams({ orig: toParam(orig), dest: toParam(dest), mode });
  return getJSON<Trip>(`/v1/trip?${qs}`, signal);
}

/** Pasa una cámara de la API al Feature GeoJSON que pintan el mapa y el panel. */
export function toCameraOnRoute(c: TripCamera): CameraOnRoute {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: c.position },
    properties: {
      id: c.id,
      name: c.name,
      source: c.source,
      imageUrl: c.imageUrl,
      offsetM: c.distanceM,
      alongM: c.alongM,
    },
  };
}

export async function fetchElectricityNow(signal?: AbortSignal): Promise<ElectricityNow> {
  if (USE_MOCKS) {
    // Respuesta real del 19/11/2026 a las 15:35 (mismo cast que fetchTrip).
    return (await import("@/mocks/electricity-now.json")).default as unknown as ElectricityNow;
  }
  return getJSON<ElectricityNow>("/v1/electricity/now", signal);
}

export async function fetchElectricityToday(signal?: AbortSignal): Promise<ElectricityToday> {
  if (USE_MOCKS) {
    return (await import("@/mocks/electricity-today.json")).default as unknown as ElectricityToday;
  }
  return getJSON<ElectricityToday>("/v1/electricity/today", signal);
}


export async function fetchNeighborhoodZones(parent?: string, signal?: AbortSignal): Promise<NeighborhoodZones> {
  if (USE_MOCKS) throw new Error("Conecta la API local para consultar el Atlas del INE.");
  const query = parent ? `?${new URLSearchParams({ parent })}` : "";
  return getJSON<NeighborhoodZones>(`/v1/neighborhood/zones${query}`, signal);
}
