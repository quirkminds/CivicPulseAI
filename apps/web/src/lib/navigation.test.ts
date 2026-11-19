import { describe, expect, test } from "bun:test";
import { formatStepDistance, pointLabel, trafficDelayS } from "./navigation";
import type { Route } from "./types";

describe("formatStepDistance", () => {
  test("metros redondeados a 10 m y kilómetros con un decimal", () => {
    expect(formatStepDistance(0)).toBe("0 m");
    expect(formatStepDistance(4)).toBe("10 m");
    expect(formatStepDistance(347)).toBe("350 m");
    expect(formatStepDistance(1230)).toBe("1,2 km");
    expect(formatStepDistance(12_000)).toBe("12 km");
  });
});

describe("trafficDelayS", () => {
  const route = { durationS: 860, trafficDurationS: 905 } as Route;

  test("diferencia entre la duración con avisos DGT y sin tráfico", () => {
    expect(trafficDelayS(route)).toBe(45);
    expect(trafficDelayS({ ...route, trafficDurationS: 860 })).toBe(0);
  });
});

test("pointLabel usa lat, lng con coma decimal", () => {
  expect(pointLabel([-3.7038, 40.4168])).toBe("40,4168, -3,7038");
});
