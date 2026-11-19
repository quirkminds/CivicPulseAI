import { expect, test } from "bun:test";
import nowFixture from "@/mocks/electricity-now.json";
import todayFixture from "@/mocks/electricity-today.json";
import {
  explainExtremes,
  flowsSentence,
  hourGenerationMix,
  INE_REFERENCE_ZONES,
  marketPriceStatus,
  TECHS,
  washerExample,
  zoneElectricityImpact,
} from "./energy";
import type { ElectricityNow, ElectricityToday } from "./types";

const today = todayFixture as unknown as ElectricityToday;
const now = nowFixture as unknown as ElectricityNow;

test("explainExtremes compara la hora más cara con la más barata (datos reales del 19/11)", () => {
  const lines = explainExtremes(today);
  expect(lines[0]).toContain("A las 20:00");
  expect(lines[0]).toContain("01:00");
  expect(lines.join(" ")).toContain("eólica");
  expect(lines.join(" ")).toContain("periodo punta");
});

test("explainExtremes no inventa nada si no hay extremos", () => {
  expect(explainExtremes({ ...today, extremes: null })).toEqual([]);
});

test("washerExample calcula el ahorro de un ciclo de 1 kWh", () => {
  const ex = washerExample(today);
  expect(ex?.saving.replace(/\s/g, " ")).toBe("0,24 €");
});

test("flowsSentence resume exportaciones y bombeo", () => {
  expect(flowsSentence(now)).toBe("Sobra energía: 4,4 GW se exportan, 4,1 GW suben agua a los embalses (bombeo).");
});

test("todas las tecnologías de la mezcla tienen textos", () => {
  for (const m of now.mix) expect(TECHS[m.id].label.length).toBeGreaterThan(0);
});

test("marketPriceStatus detecta precio negativo, 0 €/MWh y horas normales", () => {
  // 12:00 en el fixture del 19/11 tiene market = -0.0003 €/kWh (-0,3 €/MWh)
  const paying = marketPriceStatus(today, 12);
  expect(paying?.kind).toBe("paying");
  expect(paying?.marketEurPerMwh).toBe(-0.3);
  expect(paying?.negativeHours.length).toBe(3);

  // 15:00 tiene market = 0
  const free = marketPriceStatus(today, 15);
  expect(free?.kind).toBe("free-energy");
  expect(free?.zeroOrNegativeHours.length).toBe(6);

  // 20:00 es punta normal con market positivo
  const normal = marketPriceStatus(today, 20);
  expect(normal?.kind).toBe("normal");
  expect(normal?.headline).toContain("punta");
});

test("hourGenerationMix devuelve MW reales o estima bloques si faltan", () => {
  const withGen = today.hours[12]!;
  expect(hourGenerationMix(withGen)?.solar).toBeGreaterThan(10_000);

  const withoutGen = { ...withGen, generation: null };
  const estimated = hourGenerationMix(withoutGen);
  expect(estimated).not.toBeNull();
  expect(estimated!.solar).toBeGreaterThan(10_000);

  // Hora futura sin demandMw ni renewableShare
  expect(hourGenerationMix(today.hours[20]!)).toBeNull();
});

test("zoneElectricityImpact calcula factura, ahorro y peso sobre la renta INE", () => {
  const vallecas = INE_REFERENCE_ZONES.find((z) => z.id === "district-2807913")!;
  const impact = zoneElectricityImpact(today, vallecas, 270);
  expect(impact.monthlyEurAvg).toBeCloseTo(270 * today.average, 2);
  expect(impact.monthlySavingEur).toBeGreaterThan(5);
  expect(impact.incomeSharePct).toBeGreaterThan(4);
});
