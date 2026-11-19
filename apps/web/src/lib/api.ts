import { API_URL } from "@/api-url";
import type { CameraCollection, LngLat, Route } from "./types";

/**
 * Cliente de la API (apps/api). El contrato vive en apps/api/openapi.yaml.
 *
 * Sin `VITE_API_URL` se sirven fixtures generados a partir de respuestas reales de CartoCiudad
 * y del KML de cámaras del Ayuntamiento. Las rutas de CartoCiudad e informo.madrid.es no envían
 * cabeceras CORS, así que pasan por la API (ver docs/fuentes-de-datos.md).
 */
export const USE_MOCKS = API_URL === undefined;

const toParam = ([lng, lat]: LngLat) => `${lat},${lng}`;

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchRoute(orig: LngLat, dest: LngLat, signal?: AbortSignal): Promise<Route> {
  if (USE_MOCKS) {
    // El fixture es siempre Sol → Campus Sur, independientemente de origen y destino.
    return (await import("@/mocks/route-sol-campus-sur.json")).default as Route;
  }
  const qs = new URLSearchParams({ orig: toParam(orig), dest: toParam(dest), vehicle: "CAR" });
  return getJSON<Route>(`/v1/route?${qs}`, signal);
}

export async function fetchCameras(signal?: AbortSignal): Promise<CameraCollection> {
  if (USE_MOCKS) {
    return (await import("@/mocks/cameras-madrid.json")).default as CameraCollection;
  }
  return getJSON<CameraCollection>("/v1/cameras", signal);
}
