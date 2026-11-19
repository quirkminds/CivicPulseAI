import { useEffect, useState } from "react";
import { type BasemapId, type BasemapStyles, loadBasemap } from "@/lib/basemaps";

const STORAGE_KEY = "civicpulse.basemap";

function readStored(): BasemapId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "ign" || v === "pnoa" ? v : "carto";
  } catch {
    return "carto";
  }
}

/** Mapa base elegido (recordado por dispositivo) y sus estilos ya cargados. */
export function useBasemap() {
  const [id, setId] = useState<BasemapId>(readStored);
  const [loaded, setLoaded] = useState<{ id: BasemapId; styles: BasemapStyles } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBasemap(id)
      .then((styles) => {
        if (cancelled) return;
        setLoaded({ id, styles });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda.
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Mientras carga el nuevo, se mantiene el anterior para no parpadear.
  return { id, setId, styles: loaded?.styles, error };
}
