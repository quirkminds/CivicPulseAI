import type { LngLat, Route, TravelMode } from "./types";

/** Etiquetas y colores de ruta por modo. Los colores pasan el validador de contraste sobre el mapa oscuro. */
export const TRAVEL_MODES: Record<TravelMode, { label: string; routeColor: string }> = {
  car: { label: "Coche", routeColor: "#3b82f6" },
  walk: { label: "A pie", routeColor: "#a855f7" },
  bike: { label: "Bici", routeColor: "#14b8a6" },
};

const meters = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const km = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Distancia de un paso: «80 m», «350 m», «1,2 km», «12 km». Por debajo de 1 km se redondea a 10 m. */
export function formatStepDistance(m: number) {
  if (m < 1000) return `${meters.format(Math.max(Math.round(m / 10) * 10, m > 0 ? 10 : 0))} m`;
  return `${km.format(m / 1000)} km`;
}

/** Segundos de retraso por tráfico que suma la DGT a la ruta (0 si no hay avisos o no es en coche). */
export const trafficDelayS = (route: Route) => Math.max(route.trafficDurationS - route.durationS, 0);

/** Nombre de un punto elegido en el mapa, a falta de buscador: «40,4168, -3,7038». */
export function pointLabel([lng, lat]: LngLat) {
  const f = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return `${f.format(lat)}, ${f.format(lng)}`;
}
