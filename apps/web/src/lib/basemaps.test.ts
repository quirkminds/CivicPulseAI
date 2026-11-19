import { expect, test } from "bun:test";
import type { StyleSpecification } from "maplibre-gl";
import { patchIgnStyle } from "./basemaps";

// Fragmento real de mapaBase_scn_color1_CNIG.json (2026-11-19).
const ign = {
  version: 8,
  sources: {
    mapaBaseXYZ: {
      type: "vector",
      tiles: ["https://vt-mapabase.idee.es/1.0.0/mapabase/{z}/{x}/{y}.pbf"],
      minZoom: 0,
      maxZoom: 17,
    },
    cmdsl003w: { type: "raster-dem", tiles: ["https://xyz-mdt.idee.es/1.0.0/raster-dem/{z}/{x}/{y}.png"], maxzoom: 15 },
  },
  layers: [],
} as unknown as StyleSpecification;

test("patchIgnStyle fija maxzoom 17 y añade la atribución CC BY 4.0", () => {
  const patched = patchIgnStyle(ign);
  const vector = patched.sources.mapaBaseXYZ as Record<string, unknown>;
  expect(vector.maxzoom).toBe(17);
  expect(vector.maxZoom).toBeUndefined();
  expect(String(vector.attribution)).toContain("IGN-CNIG");
  expect(String(vector.attribution)).toContain("CC BY 4.0");
});

test("patchIgnStyle no toca las fuentes no vectoriales", () => {
  expect(patchIgnStyle(ign).sources.cmdsl003w).toBe(ign.sources.cmdsl003w);
});
