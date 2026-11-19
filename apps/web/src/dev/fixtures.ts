import { camerasAlongRoute, routeCorridor } from "@/lib/geo";
import type { CameraCollection, Route } from "@/lib/types";
import camerasJson from "@/mocks/cameras-madrid.json";
import routeJson from "@/mocks/route-sol-campus-sur.json";
import { CAMERA_CORRIDOR_M } from "@/features/trayecto/use-trayecto";

/** Los mismos datos de ejemplo que usa la app sin API (Sol → Campus Sur), ya cruzados. */
// Mismo cast que api.ts: el JSON importado tipa las coordenadas como number[], no como tupla.
export const sampleRoute = routeJson as Route;
const sampleCameras = camerasJson as CameraCollection;

export const sampleCorridor = routeCorridor(sampleRoute.geometry, CAMERA_CORRIDOR_M);
export const sampleCamerasOnRoute = camerasAlongRoute(sampleRoute.geometry, sampleCameras, CAMERA_CORRIDOR_M);
