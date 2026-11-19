import type { StyleSpecification } from "maplibre-gl";
import { CARTO_DARK } from "@/lib/basemaps";

const TERRITORY = "ine-territory";

const territoryLayers: StyleSpecification["layers"] = [
  { id: "ine-territory-fill", type: "fill", source: TERRITORY, paint: { "fill-color": "#182426" } },
  {
    id: "ine-territory-outline",
    type: "line",
    source: TERRITORY,
    paint: { "line-color": "#607879", "line-width": 1 },
  },
];

export const territorialStyle: StyleSpecification = {
  version: 8,
  sources: {
    [TERRITORY]: {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}maps/ine-territorios-2025.geojson`,
      attribution: '<a href="https://www.ine.es/dyngs/DAB/es/index.htm?cid=1389">© INE · Cartografía censal 2025</a>',
    },
  },
  layers: [
    { id: "ine-background", type: "background", paint: { "background-color": "#0d1417" } },
    ...territoryLayers,
  ],
};

export async function loadBarrioStreetStyle(signal: AbortSignal): Promise<StyleSpecification> {
  const response = await fetch(CARTO_DARK, { signal });
  if (!response.ok) throw new Error("Callejero no disponible.");
  const style: StyleSpecification = await response.json();
  if (style?.version !== 8 || !Array.isArray(style.layers) || !style.sources) {
    throw new Error("Estilo del callejero no válido.");
  }

  // Los límites locales quedan por encima del fondo y por debajo de las teselas.
  // Si faltan teselas en una zona, su contorno sigue siendo visible.
  const background = style.layers.filter((layer) => layer.type === "background");
  const cartography = style.layers.filter((layer) => layer.type !== "background");
  return {
    ...style,
    sources: { ...style.sources, ...territorialStyle.sources },
    layers: [...background, ...territoryLayers, ...cartography],
  };
}
