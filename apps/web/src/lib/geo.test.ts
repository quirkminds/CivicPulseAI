import { describe, expect, test } from "bun:test";
import camerasFixture from "@/mocks/cameras-madrid.json";
import routeFixture from "@/mocks/route-sol-campus-sur.json";
import { camerasAlongRoute, makeCamera, routeCorridor, routeLengthM } from "./geo";
import type { CameraCollection, Route } from "./types";

// Ruta real de CartoCiudad (Sol → Campus Sur): solo hacen falta la geometría y la distancia.
const route = routeFixture as Pick<Route, "geometry" | "distanceM">;
const cameras = camerasFixture as CameraCollection;

describe("camerasAlongRoute", () => {
  // Ruta recta de oeste a este por la latitud 40.4 (~8,5 km)
  const straight = {
    type: "LineString" as const,
    coordinates: [
      [-3.7, 40.4],
      [-3.6, 40.4],
    ],
  };

  test("filtra por distancia a la ruta y ordena en el sentido de la marcha", () => {
    const fc: CameraCollection = {
      type: "FeatureCollection",
      features: [
        makeCamera("lejos", -3.65, 40.41), // ~1,1 km al norte
        makeCamera("final", -3.61, 40.4005), // ~55 m, cerca del final
        makeCamera("inicio", -3.69, 40.3995), // ~55 m, cerca del inicio
      ],
    };
    const ids = camerasAlongRoute(straight, fc, 300).map((c) => c.properties.id);
    expect(ids).toEqual(["inicio", "final"]);
  });

  test("calcula offset y posición a lo largo de la ruta en metros", () => {
    const fc: CameraCollection = {
      type: "FeatureCollection",
      features: [makeCamera("a", -3.65, 40.4)],
    };
    const [cam] = camerasAlongRoute(straight, fc);
    if (!cam) throw new Error("se esperaba una cámara");
    expect(cam.properties.offsetM).toBeLessThan(5); // geodésica vs. paralelo
    expect(cam.properties.alongM).toBeGreaterThan(4200);
    expect(cam.properties.alongM).toBeLessThan(4300);
  });

  test("con datos reales encuentra cámaras en la ruta Sol → Campus Sur", () => {
    const found = camerasAlongRoute(route.geometry, cameras, 300);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.properties.offsetM <= 300)).toBe(true);
  });
});

test("la longitud geométrica cuadra con la distancia de CartoCiudad", () => {
  const ratio = routeLengthM(route.geometry) / route.distanceM;
  expect(ratio).toBeGreaterThan(0.95);
  expect(ratio).toBeLessThan(1.05);
});

test("routeCorridor devuelve un polígono", () => {
  expect(routeCorridor(route.geometry, 300)?.geometry.type).toBe("Polygon");
});
