import { expect, test } from "bun:test";
import { formatEur, formatPricePerLiter, incidentLabel } from "./format";

test("formatea euros y €/l en castellano", () => {
  expect(formatEur(28.84).replace(/\s/g, " ")).toBe("28,84 €");
  expect(formatPricePerLiter(1.359)).toBe("1,359 €/l");
});

test("traduce las causas DATEX II y tiene respaldo", () => {
  expect(incidentLabel("roadMaintenance")).toBe("Obras");
  expect(incidentLabel("desconocida")).toBe("Incidencia");
});

test("formatGw pasa a MW por debajo de 1 GW", async () => {
  const { formatGw } = await import("./format");
  expect(formatGw(32300)).toBe("32,3 GW");
  expect(formatGw(368)).toBe("368 MW");
});
