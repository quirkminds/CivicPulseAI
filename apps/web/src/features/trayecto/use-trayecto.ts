import { useEffect, useMemo, useState } from "react";
import { fetchCameras, fetchRoute } from "@/lib/api";
import { camerasAlongRoute, routeCorridor } from "@/lib/geo";
import type { CameraCollection, LngLat, Route } from "@/lib/types";

export const CAMERA_CORRIDOR_M = 300;

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; route: Route; cameras: CameraCollection };

type Settled = Exclude<State, { status: "loading" }>;

const LOADING: State = { status: "loading" };

export function useTrayecto(origin: LngLat, destination: LngLat) {
  const key = `${origin.join(",")}|${destination.join(",")}`;
  // Guarda el último resultado junto a la ruta que lo pidió: si no coincide con la actual, está cargando.
  const [settled, setSettled] = useState<{ key: string; state: Settled } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([fetchRoute(origin, destination, ctrl.signal), fetchCameras(ctrl.signal)])
      .then(([route, cameras]) => setSettled({ key, state: { status: "ready", route, cameras } }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error = err instanceof Error ? err.message : String(err);
        setSettled({ key, state: { status: "error", error } });
      });
    return () => ctrl.abort();
  }, [key, origin, destination]);

  const state: State = settled?.key === key ? settled.state : LOADING;

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    return {
      corridor: routeCorridor(state.route.geometry, CAMERA_CORRIDOR_M),
      camerasOnRoute: camerasAlongRoute(state.route.geometry, state.cameras, CAMERA_CORRIDOR_M),
    };
  }, [state]);

  return { state, ...derived };
}
