import { useState } from "react";
import { reverseGeocode } from "@/lib/geocoder";
import { pointLabel } from "@/lib/navigation";
import type { LngLat } from "@/lib/types";

/** Origen o destino del trayecto: un punto con su nombre y, si es un campus, su id. */
export type Endpoint = { coords: LngLat; label: string; campusId: string | null };

export function useEndpoint(initial: Endpoint) {
  const [point, setPoint] = useState(initial);

  /**
   * Punto sin nombre (marcador arrastrado o ubicación del navegador): se muestra con las coordenadas
   * y, en cuanto CartoCiudad responde, con la dirección más cercana. `prefix` antepone «Mi ubicación».
   */
  const setFromMap = (coords: LngLat, prefix?: string) => {
    setPoint({ coords, label: prefix ?? `Punto del mapa (${pointLabel(coords)})`, campusId: null });
    reverseGeocode(coords)
      .then((address) => {
        if (!address) return;
        // Si el usuario ya eligió otro punto, esta respuesta llega tarde y se descarta.
        setPoint((p) => (p.coords === coords ? { ...p, label: prefix ? `${prefix} · ${address}` : address } : p));
      })
      .catch(() => {});
  };

  return { point, set: setPoint, setFromMap };
}
