import { useEffect, useState } from "react";
import { fetchNeighborhoodZones, USE_MOCKS } from "@/lib/api";
import { INE_REFERENCE_ZONES, type ResidenceZone } from "@/lib/energy";

const STORAGE_KEY = "civicpulse.residenceZone";
const DEFAULT_ZONE: ResidenceZone = INE_REFERENCE_ZONES[0] ?? {
  id: "municipality-28079",
  name: "Madrid",
  income: 18_826,
  singlePersonHouseholds: 32.1,
};

function readStoredZoneId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ZONE.id;
  } catch {
    return DEFAULT_ZONE.id;
  }
}

/**
 * Zonas de residencia con datos del INE (ADRH). Cuando la API tiene cargado el Atlas,
 * lee los distritos de Madrid directamente de `/v1/neighborhood/zones`; si no, usa el catálogo de referencia INE.
 */
export function useResidenceZone() {
  const [zones, setZones] = useState<ResidenceZone[]>(INE_REFERENCE_ZONES);
  const [fromApi, setFromApi] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(readStoredZoneId);

  useEffect(() => {
    if (USE_MOCKS) return;
    const ctrl = new AbortController();
    fetchNeighborhoodZones("municipality-28079", ctrl.signal)
      .then((fc) => {
        if (ctrl.signal.aborted || fc.features.length === 0) return;
        const apiZones: ResidenceZone[] = fc.features
          .map((f) => ({
            id: f.properties.id,
            name: f.properties.name,
            income: f.properties.income,
            singlePersonHouseholds: f.properties.singlePersonHouseholds,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        setZones(apiZones);
        setFromApi(true);
      })
      .catch(() => {
        // Sin tabla INE importada o sin API: mantiene el catálogo de referencia del INE.
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedId);
    } catch {
      // Modo privado: no persiste.
    }
  }, [selectedId]);

  const fallback = zones[0] ?? DEFAULT_ZONE;
  const zone = zones.find((z) => z.id === selectedId) ?? fallback;

  return { zones, zone, selectedId: zone.id, setSelectedId, fromApi };
}
