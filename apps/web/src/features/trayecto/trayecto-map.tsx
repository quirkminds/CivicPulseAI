import { bbox } from "@turf/bbox";
import { CameraIcon, ConstructionIcon, FlagIcon, FuelIcon, GaugeIcon, HomeIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { Feature, Polygon } from "geojson";
import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BASEMAPS } from "@/lib/basemaps";
import { formatKm, formatPricePerLiter, incidentLabel } from "@/lib/format";
import { pointLngLat } from "@/lib/geo";
import { TRAVEL_MODES } from "@/lib/navigation";
import type { CameraOnRoute, Incident, LngLat, Route, Station, TripTraffic } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TrayectoLayer } from "./trayecto-panel";
import { useBasemap } from "./use-basemap";

const MADRID: LngLat = [-3.7038, 40.4168];

/** Las rutas salen de Valhalla sobre OpenStreetMap (ODbL exige citarlo) o, de respaldo, de CartoCiudad. */
const ATTRIBUTION = { compact: true, customAttribution: "Rutas: © OpenStreetMap contributors · CartoCiudad (CNIG)" };

const PHOTO_TIMEOUT_MS = 8000;

type DragEnd = (lngLat: { lng: number; lat: number }) => void;

type Props = {
  origin: LngLat;
  destination: LngLat;
  route?: Route;
  corridor?: Feature<Polygon>;
  cameras: CameraOnRoute[];
  stations?: Station[];
  incidents?: Incident[];
  /** Cortes y tramos lentos de la DGT que afectan a la ruta. */
  traffic?: TripTraffic;
  /** Con callback, el marcador se puede arrastrar para cambiar el punto. */
  onOriginChange?: (coords: LngLat) => void;
  onDestinationChange?: (coords: LngLat) => void;
  /** Capa activa bajo demanda (`null` = mapa limpio + alertas críticas; `undefined` = todas visibles). */
  activeLayer?: TrayectoLayer | null;
  selectedCameraId?: string | null;
  focusPoint?: { coords: LngLat; seq: number } | null;
  /** Deja margen a la izquierda al encuadrar la ruta para no taparla con la tarjeta flotante. */
  floatingCardOffset?: boolean;
};

export function TrayectoMap({
  origin,
  destination,
  route,
  corridor,
  cameras,
  stations = [],
  incidents = [],
  traffic,
  onOriginChange,
  onDestinationChange,
  activeLayer,
  selectedCameraId,
  focusPoint,
  floatingCardOffset = false,
}: Props) {
  const basemap = useBasemap();

  // Las cámaras se ven siempre sobre la ruta (pequeñas); al abrir su capa se resaltan y aparece la franja.
  const camerasHighlighted = activeLayer === undefined || activeLayer === "cameras";
  const showStations = activeLayer === undefined || activeLayer === "stations";
  // Las incidencias DGT son alertas reales sobre la ruta: se muestran siempre que existan.
  const showIncidents = incidents.length > 0;
  const incidentsHighlighted = activeLayer === "incidents";

  return (
    <Map center={MADRID} zoom={11} className="h-full w-full" styles={basemap.styles} attributionControl={ATTRIBUTION}>
      <MapControls
        position="bottom-right"
        showZoom
        showCompass
        showLocate
        showFullscreen
        onLocate={onOriginChange && ((c) => onOriginChange([c.longitude, c.latitude]))}
      />

      <div
        className={cn(
          "absolute right-3 z-10 flex flex-col items-end gap-1",
          floatingCardOffset ? "top-16 md:top-3" : "top-3",
        )}
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={basemap.id}
          onValueChange={(v) => v && basemap.setId(v as typeof basemap.id)}
          className="rounded-lg bg-background/85 shadow-lg backdrop-blur-xl"
          aria-label="Mapa base"
        >
          {BASEMAPS.map((b) => (
            <ToggleGroupItem key={b.id} value={b.id} className="text-xs">
              {b.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {basemap.error && (
          <p className="rounded-md bg-destructive/15 px-2 py-1 text-xs text-destructive backdrop-blur">
            {basemap.error}
          </p>
        )}
      </div>

      {camerasHighlighted && corridor && (
        <MapGeoJSON
          id="route-corridor"
          data={corridor}
          fillPaint={{ "fill-color": "#3b82f6", "fill-opacity": 0.1 }}
          linePaint={{ "line-color": "#60a5fa", "line-opacity": 0.35, "line-width": 1 }}
        />
      )}

      {route && (
        <>
          <MapRoute
            id="trip-route"
            coordinates={route.geometry.coordinates as [number, number][]}
            color={TRAVEL_MODES[route.mode].routeColor}
            width={5}
            opacity={0.92}
          />
          <FitToRoute route={route} floatingCardOffset={floatingCardOffset} />
        </>
      )}

      <MapMarker
        longitude={origin[0]}
        latitude={origin[1]}
        draggable={onOriginChange !== undefined}
        onDragEnd={onOriginChange && toLngLat(onOriginChange)}
      >
        <MarkerContent>
          <Pin className={cn("bg-foreground text-background", onOriginChange && "cursor-grab")}>
            <HomeIcon className="size-3.5" />
          </Pin>
        </MarkerContent>
        <MarkerTooltip>{onOriginChange ? "Origen · arrástralo para cambiarlo" : "Origen"}</MarkerTooltip>
      </MapMarker>

      <MapMarker
        longitude={destination[0]}
        latitude={destination[1]}
        draggable={onDestinationChange !== undefined}
        onDragEnd={onDestinationChange && toLngLat(onDestinationChange)}
      >
        <MarkerContent>
          <Pin className={cn("bg-emerald-500 text-zinc-950", onDestinationChange && "cursor-grab")}>
            <FlagIcon className="size-3.5" />
          </Pin>
        </MarkerContent>
        <MarkerTooltip>{onDestinationChange ? "Destino · arrástralo para cambiarlo" : "Destino"}</MarkerTooltip>
      </MapMarker>

      {/* Cortes de la DGT (esquivados o no) y tramos lentos: siempre visibles, son lo que cambia la ruta */}
      {[...(traffic?.closuresAvoided ?? []), ...(traffic?.closuresOnRoute ?? [])].map((c) => (
        <MapMarker key={`closure-${c.id}`} longitude={c.position[0]} latitude={c.position[1]}>
          <MarkerContent>
            <Pin className="bg-red-600 text-white">
              <ConstructionIcon className="size-3" />
            </Pin>
          </MarkerContent>
          <MarkerTooltip>Corte total DGT · {c.road}</MarkerTooltip>
        </MapMarker>
      ))}

      {traffic?.slowSegments.map((sl) => (
        <MapMarker key={`slow-${sl.id}`} longitude={sl.position[0]} latitude={sl.position[1]}>
          <MarkerContent>
            <Pin className="bg-amber-500 text-zinc-950">
              <GaugeIcon className="size-3" />
            </Pin>
          </MarkerContent>
          <MarkerTooltip>
            Tráfico lento DGT · {sl.road} ({formatKm(sl.lengthM)} km)
          </MarkerTooltip>
        </MapMarker>
      ))}

      {showStations &&
        stations.map((st, i) => (
          <MapMarker key={st.id} longitude={st.position[0]} latitude={st.position[1]}>
            <MarkerContent>
              <Pin
                className={
                  i === 0
                    ? "scale-110 bg-emerald-500 text-zinc-950 ring-emerald-300/60"
                    : "bg-sky-500 text-zinc-950"
                }
              >
                <FuelIcon className="size-3" />
              </Pin>
            </MarkerContent>
            <MarkerTooltip>
              {i === 0 && "Más barata · "}
              {st.brand} · {formatPricePerLiter(st.price)}
            </MarkerTooltip>
          </MapMarker>
        ))}

      {showIncidents &&
        incidents.map((inc) => (
          <MapMarker key={inc.id} longitude={inc.position[0]} latitude={inc.position[1]}>
            <MarkerContent>
              <Pin
                className={cn(
                  "bg-red-500 text-white",
                  incidentsHighlighted && "scale-125 ring-2 ring-red-300/80",
                )}
              >
                <TriangleAlertIcon className="size-3" />
              </Pin>
            </MarkerContent>
            <MarkerTooltip>
              {incidentLabel(inc.cause)} · {inc.road} (km {formatKm(inc.alongM)} de tu ruta)
            </MarkerTooltip>
          </MapMarker>
        ))}

      <FlyToCamera camera={cameras.find((c) => c.properties.id === selectedCameraId)} />
      <FlyToPoint target={focusPoint} />

      {cameras.map((cam) => {
        const [lng, lat] = pointLngLat(cam);
        const selected = cam.properties.id === selectedCameraId;
        return (
          <MapMarker key={cam.properties.id} longitude={lng} latitude={lat}>
            <MarkerContent>
              <Pin
                className={cn(
                  "bg-amber-400 text-zinc-950",
                  selected && "scale-125 ring-2 ring-amber-200",
                  !selected && !camerasHighlighted && "size-5 opacity-80",
                )}
              >
                <CameraIcon className={camerasHighlighted || selected ? "size-3" : "size-2.5"} />
              </Pin>
            </MarkerContent>
            <MarkerTooltip>{cam.properties.name} · pulsa para ver la foto</MarkerTooltip>
            <MarkerPopup closeButton>
              <CameraPopup camera={cam} />
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </Map>
  );
}

/** El marcador de mapcn devuelve {lng, lat}; el resto de la app trabaja con [lng, lat]. */
const toLngLat =
  (fn: (coords: LngLat) => void): DragEnd =>
  ({ lng, lat }) =>
    fn([lng, lat]);

function Pin({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid size-6 place-items-center rounded-full shadow-md ring-2 ring-background transition-transform",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CameraPopup({ camera }: { camera: CameraOnRoute }) {
  const { name, imageUrl, alongM, offsetM, source } = camera.properties;
  // Las cámaras se refrescan en origen cada pocos minutos: rompemos la caché al montar el popup
  const [cacheBust] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // informo.madrid.es no rechaza la conexión: la deja colgada y el navegador tarda más de un minuto en rendirse.
  useEffect(() => {
    if (loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), PHOTO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, failed]);
  return (
    <div className="w-72 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      {imageUrl && !failed && (
        <img
          src={`${imageUrl}?t=${cacheBust}`}
          alt={`Cámara ${name}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="aspect-[300/220] w-full bg-muted object-cover"
        />
      )}
      {(failed || !imageUrl) && (
        <p className="grid aspect-[300/220] w-full place-items-center bg-muted p-4 text-center text-xs text-muted-foreground">
          {source === "madrid"
            ? "La foto del Ayuntamiento no carga: su servidor (informo.madrid.es) no responde ahora mismo."
            : "La foto de esta cámara no está disponible ahora mismo."}
        </p>
      )}
      <div className="space-y-0.5 p-3">
        <p className="font-heading text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {source === "dgt" ? "DGT" : "Ayuntamiento de Madrid"} · km {formatKm(alongM)} de tu ruta · a {offsetM} m
        </p>
      </div>
    </div>
  );
}

/** Encaja la vista en la ruta cada vez que cambia, dejando hueco a la tarjeta flotante en escritorio. */
function FitToRoute({ route, floatingCardOffset }: { route: Route; floatingCardOffset: boolean }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const [minX, minY, maxX, maxY] = bbox(route.geometry);
    const desktop = typeof window !== "undefined" && window.innerWidth >= 768;
    const padding =
      floatingCardOffset && desktop ? { top: 88, right: 64, bottom: 64, left: 420 } : { top: 72, right: 48, bottom: 48, left: 48 };
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding, duration: 800 },
    );
  }, [map, isLoaded, route, floatingCardOffset]);
  return null;
}

function FlyToCamera({ camera }: { camera?: CameraOnRoute }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || !camera) return;
    const [lng, lat] = pointLngLat(camera);
    map.flyTo({ center: [lng, lat], zoom: 16, duration: 900 });
  }, [map, isLoaded, camera]);
  return null;
}

function FlyToPoint({ target }: { target?: { coords: LngLat; seq: number } | null }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || !target) return;
    map.flyTo({ center: target.coords, zoom: 15, duration: 800 });
  }, [map, isLoaded, target]);
  return null;
}
