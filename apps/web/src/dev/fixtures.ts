import { CAMERA_CORRIDOR_M } from "@/features/trayecto/use-trayecto";
import { camerasAlongRoute, routeCorridor } from "@/lib/geo";
import type { CameraCollection, ElectricityNow, ElectricityToday, Trip } from "@/lib/types";
import camerasJson from "@/mocks/cameras-madrid.json";
import electricityNowJson from "@/mocks/electricity-now.json";
import electricityTodayJson from "@/mocks/electricity-today.json";
import tripJson from "@/mocks/trip-car-sol-campus-sur.json";
import walkTripJson from "@/mocks/trip-walk-sol-campus-sur.json";

/** Los mismos datos de ejemplo que usa la app sin API (Sol → Campus Sur), ya cruzados. */
// Mismo cast que api.ts: el JSON importado tipa las coordenadas como number[], no como tupla.
/** Respuesta real de GET /v1/trip?mode=car (Sol → Campus Sur, Valhalla). */
export const sampleTrip = tripJson as unknown as Trip;
/** Respuesta real de GET /v1/trip?mode=walk (Sol → Campus Sur, Valhalla). */
export const sampleWalkTrip = walkTripJson as unknown as Trip;
export const sampleRoute = sampleTrip.route;

/**
 * El trayecto en coche con avisos DGT reales del 19/11/2026 superpuestos (un corte total en la M-406 y tráfico
 * lento en la A-6): en la ruta Sol → Campus Sur no había ninguno, y así se ve cómo se presentan.
 */
export const sampleTripWithTraffic: Trip = {
  ...sampleTrip,
  route: { ...sampleTrip.route, trafficDurationS: sampleTrip.route.durationS + 180 },
  traffic: {
    closuresAvoided: [{ id: "25699432", road: "M-406", position: [-3.779483, 40.319085] }],
    closuresOnRoute: [],
    slowSegments: [
      { id: "30199463", road: "A-6", type: "slowTraffic", lengthM: 1575, delayS: 180, position: [-3.7794, 40.4632] },
    ],
  },
};
const sampleCameras = camerasJson as CameraCollection;

export const sampleCorridor = routeCorridor(sampleRoute.geometry, CAMERA_CORRIDOR_M);
export const sampleCamerasOnRoute = camerasAlongRoute(sampleRoute.geometry, sampleCameras, CAMERA_CORRIDOR_M);
/** Respuesta real de GET /v1/electricity/today (19/11/2026). */
export const sampleElectricityToday = electricityTodayJson as unknown as ElectricityToday;
/** Respuesta real de GET /v1/electricity/now (19/11/2026 15:35). */
export const sampleElectricityNow = electricityNowJson as unknown as ElectricityNow;
