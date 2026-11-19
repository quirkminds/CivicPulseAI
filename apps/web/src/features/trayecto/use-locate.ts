import { useState } from "react";
import type { LngLat } from "@/lib/types";

const MESSAGES: Record<number, string> = {
  1: "Has denegado el acceso a tu ubicación. Actívalo en el navegador o arrastra el marcador de origen.",
  2: "No se pudo obtener tu ubicación. Arrastra el marcador de origen.",
  3: "Tu ubicación tarda demasiado. Vuelve a intentarlo o arrastra el marcador de origen.",
};

/** Una sola lectura de la ubicación del navegador (no es una app de seguimiento GPS). */
export function useLocate(onLocated: (coords: LngLat) => void) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError("Este navegador no permite obtener tu ubicación.");
      return;
    }
    setLocating(true);
    setError(undefined);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        onLocated([coords.longitude, coords.latitude]);
      },
      (err) => {
        setLocating(false);
        setError(MESSAGES[err.code] ?? MESSAGES[2]);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return { locate, locating, error };
}
