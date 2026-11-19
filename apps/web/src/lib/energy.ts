import { formatEur, formatEurPerKwh, formatHour, formatPercent } from "./format";
import type { ElectricityNow, ElectricityToday, GenerationMix, HourInfo, TariffPeriod, TechId } from "./types";

/**
 * Qué es cada tecnología que aparece en ESIOS, de dónde sale y por qué abarata o encarece la luz.
 * Los MW y porcentajes llegan de la API (`/v1/electricity/now`); aquí solo los textos.
 */
export const TECHS: Record<TechId, { label: string; origin: string; price: string }> = {
  "solar-pv": {
    label: "Solar fotovoltaica",
    origin: "Paneles solares, sobre todo en Extremadura, Castilla-La Mancha y Andalucía.",
    price:
      "Producir un kWh más no cuesta casi nada (el sol no se paga). A mediodía hay tanta que empuja el precio del mercado hacia 0 €/MWh. Solo produce de día.",
  },
  wind: {
    label: "Eólica",
    origin: "Aerogeneradores, con más potencia en Castilla y León, Aragón, Castilla-La Mancha y Galicia.",
    price:
      "Como la solar, su coste por kWh extra es casi nulo. Depende del viento, que muchas veces sopla de noche: por eso hay madrugadas con la energía casi gratis.",
  },
  hydro: {
    label: "Hidráulica",
    origin: "Embalses, sobre todo en las cuencas del Duero, Tajo, Miño-Sil y Ebro.",
    price:
      "El agua embalsada se guarda para cuando la luz está cara: oferta cerca del precio de la alternativa (el gas), así que produce más en las horas punta.",
  },
  "solar-thermal": {
    label: "Solar termoeléctrica",
    origin: "Centrales de espejos en Andalucía y Extremadura; algunas guardan calor en sales para producir al anochecer.",
    price: "Renovable y sin combustible, pero con poca potencia instalada: apenas mueve el precio.",
  },
  "renewable-thermal": {
    label: "Biomasa y biogás",
    origin: "Centrales que queman restos forestales y agrícolas o biogás.",
    price: "Renovable, pero paga su combustible: produce de forma bastante constante.",
  },
  nuclear: {
    label: "Nuclear",
    origin: "Siete reactores en cinco centrales: Almaraz (Cáceres), Ascó y Vandellós (Tarragona), Cofrentes (Valencia) y Trillo (Guadalajara).",
    price:
      "Produce casi lo mismo de día y de noche porque no puede subir y bajar rápido. No emite CO₂ y casi nunca marca el precio: cobra el que fije el mercado.",
  },
  "combined-cycle": {
    label: "Ciclo combinado (gas)",
    origin: "Centrales de gas natural, que España importa por gasoducto y en barco.",
    price:
      "Es la que suele marcar el precio cuando no hay suficiente sol ni viento, sobre todo al anochecer. El gas es caro y además paga derechos de CO₂.",
  },
  cogeneration: {
    label: "Cogeneración y resto",
    origin: "Industrias que producen calor y electricidad a la vez, sobre todo con gas, y plantas de residuos.",
    price: "Produce según la actividad de la industria; su coste va ligado al del gas.",
  },
  coal: {
    label: "Carbón",
    origin: "Las últimas centrales de carbón de la península están cerradas o en cierre.",
    price: "La más contaminante y, con los derechos de CO₂, de las más caras.",
  },
  "fuel-gas": {
    label: "Fuel y gas",
    origin: "Grupos antiguos que apenas se usan en la península.",
    price: "Muy caros: solo entran en situaciones excepcionales.",
  },
  "pumped-hydro": {
    label: "Bombeo (turbinando)",
    origin: "Agua que se subió a un embalse superior cuando la luz era barata y ahora se suelta para producir.",
    price: "Funciona como una batería gigante: compra energía en las horas baratas y la vende en las caras.",
  },
  batteries: {
    label: "Baterías",
    origin: "Baterías conectadas a la red que devuelven lo que cargaron en horas baratas.",
    price: "Como el bombeo: compran barato y venden caro, y así suavizan los picos de precio.",
  },
  imports: {
    label: "Importaciones",
    origin: "Electricidad que llega por las interconexiones con Francia, Portugal y Marruecos.",
    price: "Entra cuando aquí la energía está más cara que en el país vecino.",
  },
};

export const PERIODS: Record<TariffPeriod, { label: string; hours: string }> = {
  punta: { label: "Punta", hours: "10–14 h y 18–22 h, de lunes a viernes" },
  llano: { label: "Llano", hours: "8–10 h, 14–18 h y 22–24 h, de lunes a viernes" },
  valle: { label: "Valle", hours: "0–8 h y todo el fin de semana y festivos" },
};

/** Consumo de un ciclo de lavadora para los ejemplos de ahorro (aproximado, programa de 40 °C). */
export const WASHER_KWH = 1;

/**
 * Explica por qué la hora más cara cuesta más que la más barata, solo con lo que dicen los datos:
 * cuánto pesa la energía del mercado, qué parte son peajes y cargos y qué había generando.
 */
export function explainExtremes(today: ElectricityToday): string[] {
  const ext = today.extremes;
  if (!ext) return [];
  const { cheapest: lo, priciest: hi } = ext;
  const ratio = hi.price / lo.price;
  const lines = [
    `A las ${formatHour(hi.start)} la luz cuesta ${formatEurPerKwh(hi.price)}, ${ratio.toLocaleString("es-ES", { maximumFractionDigits: 1 })} veces más que a las ${formatHour(lo.start)} (${formatEurPerKwh(lo.price)}).`,
  ];

  if (hi.market !== null && lo.market !== null) {
    let energy = `La energía en el mercado vale ${formatEurPerKwh(Math.max(hi.market, 0))} a las ${formatHour(hi.start)} y ${formatEurPerKwh(Math.max(lo.market, 0))} a las ${formatHour(lo.start)}.`;
    const loMix = mixSentence(lo);
    if (loMix) energy += ` A las ${formatHour(lo.start)} ${loMix}, que producen casi gratis.`;
    if (hi.solarShare === null || hi.solarShare < 5) {
      energy += ` A las ${formatHour(hi.start)} no hay sol: hacen falta centrales más caras, sobre todo de gas, y la última que entra fija el precio para todas.`;
    }
    lines.push(energy);
  }

  if (hi.regulated !== null && lo.regulated !== null && hi.period && lo.period && hi.period !== lo.period) {
    lines.push(
      `Además, las ${formatHour(hi.start)} son periodo ${hi.period} y las ${formatHour(lo.start)}, ${lo.period}: los peajes y cargos pasan de ${formatEurPerKwh(lo.regulated)} a ${formatEurPerKwh(hi.regulated)}.`,
    );
  }

  return lines;
}

function mixSentence(h: HourInfo): string | null {
  if (h.renewableShare === null) return null;
  const parts = [`las renovables daban el ${formatPercent(h.renewableShare)}`];
  if (h.windShare !== null && h.windShare >= 20) parts.push(`(eólica ${formatPercent(h.windShare)})`);
  else if (h.solarShare !== null && h.solarShare >= 20) parts.push(`(solar ${formatPercent(h.solarShare)})`);
  return parts.join(" ");
}

/** «Ciclo de lavadora: 0,09 € a las 01:00 frente a 0,33 € a las 20:00». */
export function washerExample(today: ElectricityToday): { cheap: string; expensive: string; saving: string } | null {
  const ext = today.extremes;
  if (!ext) return null;
  return {
    cheap: formatEur(ext.cheapest.price * WASHER_KWH),
    expensive: formatEur(ext.priciest.price * WASHER_KWH),
    saving: formatEur((ext.priciest.price - ext.cheapest.price) * WASHER_KWH),
  };
}

/** Lo que no se consume ahora en la península, en frases cortas. */
export function flowsSentence(now: ElectricityNow): string | null {
  const { exportsMw, pumpingMw, batteriesChargeMw } = now.flows;
  const parts: string[] = [];
  const gw = (mw: number) => `${(mw / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GW`;
  if (exportsMw >= 100) parts.push(`${gw(exportsMw)} se exportan`);
  if (pumpingMw >= 100) parts.push(`${gw(pumpingMw)} suben agua a los embalses (bombeo)`);
  if (batteriesChargeMw >= 100) parts.push(`${gw(batteriesChargeMw)} cargan baterías`);
  if (parts.length === 0) return null;
  return `Sobra energía: ${parts.join(", ")}.`;
}

// ---------- Curva de generación + demanda, precios negativos y zona INE ----------

/**
 * Devuelve los MW por bloque tecnológico para la gráfica de áreas apiladas.
 * Usa `h.generation` si la API lo entrega; si no, estima los bloques a partir de `demandMw` y los %.
 */
export function hourGenerationMix(h: HourInfo): GenerationMix | null {
  if (h.generation) return h.generation;
  if (h.demandMw === null || h.renewableShare === null) return null;

  const total = h.demandMw;
  const solar = Math.round((total * (h.solarShare ?? 0)) / 100);
  const wind = Math.round((total * (h.windShare ?? 0)) / 100);
  const renewTotal = Math.round((total * h.renewableShare) / 100);
  const hydro = Math.max(renewTotal - solar - wind, 0);
  const nonRenew = Math.max(total - renewTotal, 0);
  const nuclear = Math.round(nonRenew * 0.62);
  const gas = Math.round(nonRenew * 0.32);
  const other = Math.max(nonRenew - nuclear - gas, 0);

  return { hydro, nuclear, gas, wind, solar, other, exports: 0, pumping: 0 };
}

export type MarketPriceStatus = {
  kind: "paying" | "free-energy" | "normal";
  current: HourInfo;
  /** Precio del mercado diario (OMIE) en €/MWh; negativo = el mercado paga por consumir energía. */
  marketEurPerMwh: number | null;
  zeroOrNegativeHours: HourInfo[];
  negativeHours: HourInfo[];
  headline: string;
  detail: string;
};

/**
 * Responde directamente a «¿está pagando la red por consumir ahora?» diferenciando con rigor
 * el mercado mayorista (OMIE, que puede ser 0 o negativo) de los peajes y cargos regulados del PVPC.
 */
export function marketPriceStatus(today: ElectricityToday, currentHour: number): MarketPriceStatus | null {
  const current = today.hours[currentHour] ?? today.hours[0];
  if (!current) return null;

  const zeroOrNegativeHours = today.hours.filter((h) => h.market !== null && h.market <= 0);
  const negativeHours = today.hours.filter((h) => h.market !== null && h.market < 0);
  const marketEurPerMwh = current.market !== null ? Math.round(current.market * 10_000) / 10 : null;
  const regulated = current.regulated ?? current.price;
  const mwhText =
    marketEurPerMwh !== null
      ? `${marketEurPerMwh.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} €/MWh`
      : null;

  if (current.market !== null && current.market < 0) {
    return {
      kind: "paying",
      current,
      marketEurPerMwh,
      zeroOrNegativeHours,
      negativeHours,
      headline: `Mercado en negativo (${mwhText}): la red paga por absorber energía`,
      detail: `Sobra generación renovable ahora mismo. En PVPC 2.0TD la energía sale a coste negativo y solo abonas los peajes y cargos regulados (${formatEurPerKwh(regulated)}).`,
    };
  }

  if (current.market !== null && current.market === 0) {
    const firstNeg = negativeHours[0];
    const lastNeg = negativeHours.at(-1);
    const negNote =
      firstNeg && lastNeg
        ? ` Además, hoy hay ${negativeHours.length} h en negativo (${formatHour(firstNeg.start)}–${formatHour(lastNeg.start)}).`
        : "";
    return {
      kind: "free-energy",
      current,
      marketEurPerMwh,
      zeroOrNegativeHours,
      negativeHours,
      headline: "Energía a 0 €/MWh ahora mismo en el mercado mayorista",
      detail: `Gracias al excedente renovable la energía cuesta 0 € y solo pagas peajes y cargos (${formatEurPerKwh(regulated)}).${negNote}`,
    };
  }

  const firstZero = zeroOrNegativeHours[0];
  const lastZero = zeroOrNegativeHours.at(-1);
  const windowNote =
    firstZero && lastZero
      ? ` Hoy hay ${zeroOrNegativeHours.length} h con energía mayorista a 0 € o negativa (${formatHour(firstZero.start)}–${formatHour(lastZero.start)}).`
      : "";
  const periodText = current.period ? `periodo ${PERIODS[current.period].label.toLowerCase()}` : "tarifa PVPC";

  return {
    kind: "normal",
    current,
    marketEurPerMwh,
    zeroOrNegativeHours,
    negativeHours,
    headline: `Ahora no está en negativo: ${formatEurPerKwh(current.price)} (${periodText})`,
    detail: `${mwhText ? `Mercado diario a ${mwhText} más peajes regulados.` : "Precio regulado PVPC 2.0TD."}${windowNote}`,
  };
}

export type ResidenceZone = {
  id: string;
  name: string;
  /** Renta neta media anual por persona (€/año, INE ADRH). */
  income: number | null;
  singlePersonHouseholds: number | null;
};

/**
 * Zonas de referencia del Atlas de Distribución de Renta de los Hogares (INE ADRH, 2023)
 * para usar cuando la web corre con mocks o antes de cargar el Atlas completo desde la API.
 */
export const INE_REFERENCE_ZONES: ResidenceZone[] = [
  { id: "municipality-28079", name: "Madrid (municipio)", income: 18_826, singlePersonHouseholds: 32.1 },
  { id: "district-2807918", name: "Villa de Vallecas · Campus Sur", income: 14_920, singlePersonHouseholds: 26.4 },
  { id: "municipality-28115", name: "Pozuelo de Alarcón · Montegancedo", income: 29_258, singlePersonHouseholds: 18.7 },
  { id: "district-2807901", name: "Centro (Madrid)", income: 18_410, singlePersonHouseholds: 48.2 },
  { id: "district-2807913", name: "Puente de Vallecas", income: 11_890, singlePersonHouseholds: 29.8 },
  { id: "district-2807911", name: "Carabanchel", income: 13_450, singlePersonHouseholds: 30.5 },
  { id: "district-2807904", name: "Salamanca", income: 26_120, singlePersonHouseholds: 38.9 },
  { id: "spain", name: "España (media INE)", income: 14_082, singlePersonHouseholds: 27.9 },
];

export type HouseholdProfile = {
  id: "student" | "home";
  label: string;
  kwhPerMonth: number;
};

/** Perfiles orientativos de consumo mensual (IDAE / REE): piso compartido o estudio vs. hogar medio. */
export const HOUSEHOLD_PROFILES: HouseholdProfile[] = [
  { id: "student", label: "Piso · 160 kWh/mes", kwhPerMonth: 160 },
  { id: "home", label: "Hogar · 270 kWh/mes", kwhPerMonth: 270 },
];

export type ZoneElectricityImpact = {
  monthlyEurAvg: number;
  monthlyEurSmart: number;
  monthlySavingEur: number;
  /** % de la renta neta mensual media por persona de la zona (INE). */
  incomeSharePct: number | null;
  monthlyIncomeEur: number | null;
};

/**
 * Estima la factura mensual con el PVPC medio de hoy y el ahorro al mover un 40 % del consumo
 * (lavadora, lavavajillas, termo o carga) a la franja más barata de 2 h, cruzado con la renta INE de la zona.
 */
export function zoneElectricityImpact(
  today: ElectricityToday,
  zone: Pick<ResidenceZone, "income">,
  kwhPerMonth: number,
): ZoneElectricityImpact {
  const avg = today.average;
  const cheap2h = today.cheapest.find((c) => c.hours === 2)?.average ?? today.extremes?.cheapest.price ?? avg;
  const flexShare = 0.4;
  const monthlyEurAvg = kwhPerMonth * avg;
  const monthlyEurSmart = kwhPerMonth * ((1 - flexShare) * avg + flexShare * cheap2h);
  const monthlySavingEur = Math.max(monthlyEurAvg - monthlyEurSmart, 0);
  const monthlyIncomeEur = zone.income && zone.income > 0 ? zone.income / 12 : null;
  const incomeSharePct = monthlyIncomeEur ? (monthlyEurAvg / monthlyIncomeEur) * 100 : null;

  return {
    monthlyEurAvg,
    monthlyEurSmart,
    monthlySavingEur,
    incomeSharePct,
    monthlyIncomeEur,
  };
}
