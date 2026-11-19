import { useEffect, useState } from "react";
import { fetchElectricityNow, fetchElectricityToday } from "@/lib/api";
import type { ElectricityNow, ElectricityToday } from "@/lib/types";

type Remote<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

/** Pide `fetcher` al montar y cada `everyMs`. Si un refresco falla, se conserva el último dato bueno. */
function usePolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, everyMs: number): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ status: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    const load = () =>
      fetcher(ctrl.signal)
        .then((data) => setState({ status: "ready", data }))
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          const error = err instanceof Error ? err.message : String(err);
          setState((prev) => (prev.status === "ready" ? prev : { status: "error", error }));
        });
    void load();
    const id = setInterval(load, everyMs);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [fetcher, everyMs]);

  return state;
}

/** Datos de «Mi casa»: la red ahora mismo (cada 2 min, como la caché de la API) y los precios de hoy. */
export function useCasa() {
  const now = usePolling<ElectricityNow>(fetchElectricityNow, 2 * 60_000);
  const today = usePolling<ElectricityToday>(fetchElectricityToday, 10 * 60_000);
  return { now, today };
}
