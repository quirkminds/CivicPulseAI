import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ErrorEvent, FillLayerSpecification, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import { Map, MapControls, MapGeoJSON, useMap } from "@/components/ui/map";
import type { NeighborhoodZone, NeighborhoodZones } from "@/lib/types";
import { loadBarrioStreetStyle, territorialStyle } from "./barrio-basemap";

export const ZONE_COLORS = ["#133c41", "#19565a", "#217573", "#34988b", "#66c1a5"] as const;
export const MISSING_COLOR = "#414652";
const SPAIN: LngLatBoundsLike = [-18.35, 27.5, 4.45, 44.05];

type Layout = {
  panelRef: RefObject<HTMLElement | null>;
  underHeader: boolean;
};

type MapProps = Layout & {
  zones?: NeighborhoodZones;
  parent?: NeighborhoodZone;
  selected?: NeighborhoodZone;
  metric: "income" | "population" | "meanAge";
  thresholds: readonly [number, number, number, number];
  onSelect: (zone: NeighborhoodZone) => void;
};

function FitZone({ parent, panelRef, underHeader }: Layout & { parent?: NeighborhoodZone }) {
  const { map, isLoaded } = useMap();
  const fitted = useRef<{ map: MapLibreMap; territory: string } | null>(null);
  const territory = parent?.id ?? "spain";
  const bounds = parent?.bounds;

  useEffect(() => {
    if (!map || !isLoaded || (fitted.current?.map === map && fitted.current.territory === territory)) return;
    const [west, south, east, north] = bounds?.split(",").map(Number) ?? [];
    const extent: LngLatBoundsLike =
      west !== undefined && south !== undefined && east !== undefined && north !== undefined &&
      [west, south, east, north].every(Number.isFinite)
        ? [west, south, east, north]
        : SPAIN;
    const panel = panelRef.current?.getBoundingClientRect();
    const container = map.getContainer().getBoundingClientRect();
    const desktop = window.matchMedia("(min-width: 48rem)").matches;
    const padding = {
      top: underHeader ? 64 : 24,
      right: 24,
      bottom: desktop || !panel ? 24 : container.bottom - panel.top + 12,
      left: desktop ? (panel?.width ?? 0) + 32 : 24,
    };
    // En ventanas bajas, el panel y los márgenes no deben agotar el espacio del encuadre.
    if (padding.top + padding.bottom >= container.height) {
      padding.top = padding.bottom = 16;
    }
    map.fitBounds(extent, { padding, maxZoom: 15, duration: 0 });
    fitted.current = { map, territory };
  }, [map, isLoaded, bounds, territory, panelRef, underHeader]);

  return null;
}

function BarrioLayers({
  zones, selected, metric, thresholds, onSelect, remoteSources, onTileError,
}: Pick<MapProps, "zones" | "selected" | "metric" | "thresholds" | "onSelect"> & {
  remoteSources: string[];
  onTileError: () => void;
}) {
  const { map, isLoaded } = useMap();
  const [a, b, c, d] = thresholds;
  const [first, second, third, fourth, last] = ZONE_COLORS;
  const selectedId = selected?.id ?? "";
  const fillPaint = useMemo<FillLayerSpecification["paint"]>(() => ({
    "fill-color": [
      "case",
      ["==", ["get", metric], null], MISSING_COLOR,
      ["step", ["number", ["get", metric], 0], first, a, second, b, third, c, fourth, d, last],
    ],
    "fill-opacity": ["case", ["==", ["get", "id"], selectedId], 0.68, 0.53],
  }), [metric, selectedId, a, b, c, d, first, second, third, fourth, last]);

  useEffect(() => {
    if (!map || remoteSources.length === 0) return;
    function onError(event: ErrorEvent) {
      if ("sourceId" in event && typeof event.sourceId === "string" && remoteSources.includes(event.sourceId)) {
        onTileError();
      }
    }
    map.on("error", onError);
    return () => { map.off("error", onError); };
  }, [map, remoteSources, onTileError]);

  if (!zones || !isLoaded) return null;
  const firstLabel = map?.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

  return (
    <MapGeoJSON
      id="neighborhood-zones"
      data={zones}
      promoteId="id"
      interactive
      beforeId={firstLabel}
      onClick={({ feature }) => onSelect(feature.properties)}
      fillPaint={fillPaint}
      fillHoverPaint={{ "fill-opacity": 0.73 }}
      linePaint={{
        "line-color": ["case", ["==", ["get", "id"], selectedId], "#e4fff6", "#b2d8d2"],
        "line-width": ["case", ["==", ["get", "id"], selectedId], 2.5, 0.8],
        "line-opacity": 0.85,
      }}
    />
  );
}

export function BarrioMap({ parent, panelRef, underHeader, ...layerProps }: MapProps) {
  const [streetStyle, setStreetStyle] = useState<typeof territorialStyle>();
  const [notice, setNotice] = useState<"territorial" | "partial">();
  const style = streetStyle ?? territorialStyle;
  const remoteSources = useMemo(
    () => Object.keys(streetStyle?.sources ?? {}).filter((source) => !(source in territorialStyle.sources)),
    [streetStyle],
  );

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]);
    loadBarrioStreetStyle(signal).then(
      (loaded) => { if (!controller.signal.aborted) setStreetStyle(loaded); },
      () => { if (!controller.signal.aborted) setNotice("territorial"); },
    );
    return () => controller.abort();
  }, []);

  return (
    <section className="absolute inset-0 bg-card" aria-label="Mapa demográfico">
      <Map theme="dark" styles={{ dark: style }} bounds={SPAIN} dragRotate={false}>
        <FitZone parent={parent} panelRef={panelRef} underHeader={underHeader} />
        <BarrioLayers {...layerProps} remoteSources={remoteSources} onTileError={() => setNotice("partial")} />
        <MapControls position="top-right" className={underHeader ? "top-16 right-3" : undefined} showZoom />
        {notice && (
          <output className={`pointer-events-none absolute right-14 z-10 rounded-md border bg-background/95 px-2 py-1 text-xs ${underHeader ? "top-16" : "top-2"}`}>
            {notice === "territorial" ? "Mapa territorial" : "Callejero parcial · mapa territorial disponible"}
          </output>
        )}
      </Map>
    </section>
  );
}
