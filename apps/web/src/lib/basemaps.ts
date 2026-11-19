import type { StyleSpecification } from "maplibre-gl";

/**
 * Mapas base que se pueden pasar a mapcn (`<Map styles={…}>`). Detalle en docs/fuentes-de-datos.md.
 *
 * - carto: el de mapcn por defecto (CARTO dark-matter en modo oscuro, datos de OpenStreetMap).
 * - ign:   mapa base vectorial oficial del IGN (estilo único publicado por el IGN).
 * - pnoa:  ortofoto aérea del PNOA (IGN), ráster.
 */
export type BasemapId = "carto" | "ign" | "pnoa";

export type BasemapStyles = { light: string | StyleSpecification; dark: string | StyleSpecification };

export const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: "carto", label: "Callejero" },
  { id: "ign", label: "IGN" },
  { id: "pnoa", label: "Satélite" },
];

const CARTO_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const IGN_STYLE_URL = "https://vt-mapabase.idee.es/files/styles/mapaBase_scn_color1_CNIG.json";
const IGN_ATTRIBUTION =
  '<a href="https://www.ign.es" target="_blank" rel="noreferrer">© IGN-CNIG</a> · CartoCiudad, CC BY 4.0';
/** El IGN sirve teselas vectoriales hasta z17; en z18 responde 403. */
const IGN_MAX_TILE_ZOOM = 17;

const PNOA_TILES =
  "https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible" +
  "&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}";

/**
 * Corrige el estilo publicado por el IGN para MapLibre:
 * - declara `maxZoom`/`minZoom` (camelCase), que MapLibre ignora: sin `maxzoom` pediría teselas z18+ (403)
 *   y el mapa se quedaría en blanco al acercar. Con `maxzoom: 17` MapLibre sobreescala la z17.
 * - no declara atribución, que la licencia CC BY 4.0 exige.
 */
export function patchIgnStyle(style: StyleSpecification): StyleSpecification {
  const sources = Object.fromEntries(
    Object.entries(style.sources).map(([id, source]) => {
      if (source.type !== "vector") return [id, source];
      const { maxZoom: _max, minZoom: _min, ...rest } = source as typeof source & { maxZoom?: number; minZoom?: number };
      return [id, { ...rest, maxzoom: IGN_MAX_TILE_ZOOM, attribution: IGN_ATTRIBUTION }];
    }),
  );
  return { ...style, sources };
}

const PNOA_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    pnoa: {
      type: "raster",
      tiles: [PNOA_TILES],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '<a href="https://pnoa.ign.es" target="_blank" rel="noreferrer">PNOA © IGN-CNIG</a>, CC BY 4.0',
    },
  },
  layers: [{ id: "pnoa", type: "raster", source: "pnoa" }],
};

// Referencias estables: mapcn recarga el estilo cada vez que cambia la referencia.
const CARTO: BasemapStyles = { light: CARTO_LIGHT, dark: CARTO_DARK };
const PNOA: BasemapStyles = { light: PNOA_STYLE, dark: PNOA_STYLE };
let ign: Promise<BasemapStyles> | undefined;

export function loadBasemap(id: BasemapId): Promise<BasemapStyles> {
  if (id === "carto") return Promise.resolve(CARTO);
  if (id === "pnoa") return Promise.resolve(PNOA);
  ign ??= fetch(IGN_STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Estilo del IGN: HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .then((style) => {
      const patched = patchIgnStyle(style);
      return { light: patched, dark: patched };
    })
    .catch((err: unknown) => {
      ign = undefined; // permite reintentar
      throw err;
    });
  return ign;
}
