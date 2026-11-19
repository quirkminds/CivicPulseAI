import { useEffect, useMemo, useState } from "react";
import { fetchTrip, toCameraOnRoute } from "@/lib/api";
import { routeCorridor } from "@/lib/geo";
import type { LngLat, TravelMode, Trip } from "@/lib/types";

/** Radios que aplica la API (apps/api/store): se muestran en el panel y la franja del mapa. */
export const CAMERA_CORRIDOR_M = 300;
export const STATION_RADIUS_M = 1000;
export const INCIDENT_RADIUS_M = 500;

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; trip: Trip };

type Settled = Exclude<State, { status: "loading" }>;

const LOADING: State = { status: "loading" };

export function useTrayecto(origin: LngLat, destination: LngLat, mode: TravelMode) {
  const key = `${origin.join(",")}|${destination.join(",")}|${mode}`;
  // Guarda el último resultado junto a la ruta que lo pidió: si no coincide con la actual, está cargando.
  const [settled, setSettled] = useState<{ key: string; state: Settled } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchTrip(origin, destination, mode, ctrl.signal)
      .then((trip) => setSettled({ key, state: { status: "ready", trip } }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error = err instanceof Error ? err.message : String(err);
        setSettled({ key, state: { status: "error", error } });
      });
    return () => ctrl.abort();
  }, [key, origin, destination, mode]);

  const state: State = settled?.key === key ? settled.state : LOADING;

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const { trip } = state;
    return {
      trip,
      corridor: routeCorridor(trip.route.geometry, CAMERA_CORRIDOR_M),
      camerasOnRoute: trip.cameras.map(toCameraOnRoute),
    };
  }, [state]);

  return { state, ...derived };
}
