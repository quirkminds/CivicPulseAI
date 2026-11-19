const km = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const formatKm = (meters: number) => km.format(meters / 1000);

export function formatDuration(seconds: number) {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const eurPerLiter = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const formatEur = (value: number) => eur.format(value);
export const formatPricePerLiter = (value: number) => `${eurPerLiter.format(value)} €/l`;

/** Causas DATEX II de la DGT en castellano. Las que no estén aquí se muestran como «Incidencia». */
const INCIDENT_CAUSES: Record<string, string> = {
  roadMaintenance: "Obras",
  vehicleObstruction: "Vehículo detenido",
  obstruction: "Obstáculo en la vía",
  abnormalTraffic: "Retención",
  accident: "Accidente",
  environmentalObstruction: "Obstáculo (meteorología)",
  infrastructureDamageObstruction: "Daños en la vía",
  roadOrCarriagewayOrLaneManagement: "Cierre o desvío",
  poorEnvironment: "Mala visibilidad o meteorología",
};

export const incidentLabel = (cause: string) => INCIDENT_CAUSES[cause] ?? "Incidencia";

const kwh = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const gw = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hhmm = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** 0.0915 → "0,092 €/kWh" */
export const formatEurPerKwh = (value: number) => `${kwh.format(value)} €/kWh`;
/** 32300 MW → "32,3 GW"; por debajo de 1 GW, en MW ("368 MW"). */
export const formatGw = (mw: number) =>
  mw < 1000 ? `${Math.round(mw).toLocaleString("es-ES")} MW` : `${gw.format(mw / 1000)} GW`;
/** Hora peninsular de un instante ISO: "20:00". */
export const formatHour = (iso: string) => hhmm.format(new Date(iso));
export const formatPercent = (value: number) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
