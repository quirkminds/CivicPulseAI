import { buffer } from "@turf/buffer";
import { lineString, point } from "@turf/helpers";
import { length } from "@turf/length";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import type { Feature, LineString, Point, Polygon } from "geojson";
import type { Camera, CameraCollection, CameraOnRoute, LngLat } from "./types";

/**
 * Cámaras a menos de `maxMeters` de la ruta, ordenadas en el sentido de la marcha.
 *
 * Para el MVP se calcula en el cliente con Turf (357 puntos x ~200 vértices es trivial).
 * Cuando la API en Go esté lista, esto se mueve a PostGIS con `ST_DWithin` sobre `geography`
 * y un índice GiST; esta función queda como fallback y para los tests.
 */
export function camerasAlongRoute(
  route: LineString,
  cameras: CameraCollection,
  maxMeters = 300,
): CameraOnRoute[] {
  const line = lineString(route.coordinates);
  const result: CameraOnRoute[] = [];

  for (const cam of cameras.features) {
    const nearest = nearestPointOnLine(line, cam, { units: "meters" });
    const offsetM = nearest.properties.dist;
    if (offsetM > maxMeters) continue;
    result.push({
      ...cam,
      properties: {
        ...cam.properties,
        offsetM: Math.round(offsetM),
        alongM: Math.round(nearest.properties.location),
      },
    });
  }

  return result.sort((a, b) => a.properties.alongM - b.properties.alongM);
}

/** Pasillo de `meters` alrededor de la ruta, para pintarlo en el mapa. */
export function routeCorridor(route: LineString, meters = 300): Feature<Polygon> | undefined {
  return buffer(lineString(route.coordinates), meters, { units: "meters" }) as
    | Feature<Polygon>
    | undefined;
}

export function routeLengthM(route: LineString): number {
  return length(lineString(route.coordinates), { units: "meters" });
}

export function makeCamera(id: string, lng: number, lat: number): Camera {
  return point([lng, lat], { id, name: id, source: "madrid", imageUrl: null }) as Camera;
}

/** Coordenadas [lng, lat] de un punto GeoJSON (`Position` es `number[]` en los tipos). */
export function pointLngLat(feature: Feature<Point>): LngLat {
  const [lng, lat] = feature.geometry.coordinates;
  if (lng === undefined || lat === undefined) throw new Error("Punto GeoJSON sin coordenadas");
  return [lng, lat];
}
