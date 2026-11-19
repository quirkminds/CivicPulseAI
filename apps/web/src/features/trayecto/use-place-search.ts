import { useEffect, useState } from "react";
import { type Place, searchPlaces } from "@/lib/geocoder";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

type Result = { status: "ready"; places: Place[] } | { status: "error"; error: string };

/** Autocompletado con CartoCiudad: espera a que el usuario pare de escribir y cancela la búsqueda anterior. */
export function usePlaceSearch(query: string) {
  const q = query.trim();
  const active = q.length >= MIN_CHARS;
  // Último resultado junto a la búsqueda que lo pidió: si no coincide con la actual, está buscando.
  const [settled, setSettled] = useState<{ q: string; result: Result } | null>(null);

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((places) => setSettled({ q, result: { status: "ready", places } }))
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setSettled({ q, result: { status: "error", error: err instanceof Error ? err.message : String(err) } });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, active]);

  if (!active) return { status: "idle" as const, places: [] };
  if (settled?.q !== q) return { status: "loading" as const, places: [] };
  return settled.result.status === "ready"
    ? { status: "ready" as const, places: settled.result.places }
    : { status: "error" as const, places: [], error: settled.result.error };
}
