import { bbox } from "@turf/bbox";
import { CameraIcon, FlagIcon, HomeIcon } from "lucide-react";
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
import type { CameraOnRoute, LngLat, Route } from "@/lib/types";
import { formatKm } from "@/lib/format";
import { pointLngLat } from "@/lib/geo";
import { useBasemap } from "./use-basemap";

const MADRID: LngLat = [-3.7038, 40.4168];

type Props = {
  origin: LngLat;
  destination: LngLat;
  route?: Route;
  corridor?: Feature<Polygon>;
  cameras: CameraOnRoute[];
  selectedCameraId?: string | null;
};

export function TrayectoMap({ origin, destination, route, corridor, cameras, selectedCameraId }: Props) {
  const basemap = useBasemap();

  return (
    <Map center={MADRID} zoom={11} className="h-full w-full" styles={basemap.styles}>
      <MapControls position="bottom-right" showZoom showCompass showLocate showFullscreen />

      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={basemap.id}
          onValueChange={(v) => v && basemap.setId(v as typeof basemap.id)}
          className="bg-background/90 shadow-sm backdrop-blur"
          aria-label="Mapa base"
        >
          {BASEMAPS.map((b) => (
            <ToggleGroupItem key={b.id} value={b.id}>
              {b.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {basemap.error && (
          <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{basemap.error}</p>
        )}
      </div>

      {corridor && (
        <MapGeoJSON
          id="route-corridor"
          data={corridor}
          fillPaint={{ "fill-color": "#3b82f6", "fill-opacity": 0.08 }}
          linePaint={{ "line-color": "#3b82f6", "line-opacity": 0.3, "line-width": 1 }}
        />
      )}

      {route && (
        <>
          <MapRoute
            id="car-route"
            coordinates={route.geometry.coordinates as [number, number][]}
            color="#2563eb"
            width={5}
            opacity={0.9}
          />
          <FitToRoute route={route} />
        </>
      )}

      <MapMarker longitude={origin[0]} latitude={origin[1]}>
        <MarkerContent>
          <Pin className="bg-foreground text-background">
            <HomeIcon className="size-3.5" />
          </Pin>
        </MarkerContent>
        <MarkerTooltip>Origen</MarkerTooltip>
      </MapMarker>

      <MapMarker longitude={destination[0]} latitude={destination[1]}>
        <MarkerContent>
          <Pin className="bg-emerald-600 text-white">
            <FlagIcon className="size-3.5" />
          </Pin>
        </MarkerContent>
        <MarkerTooltip>Campus</MarkerTooltip>
      </MapMarker>

      <FlyToCamera camera={cameras.find((c) => c.properties.id === selectedCameraId)} />

      {cameras.map((cam) => {
        const [lng, lat] = pointLngLat(cam);
        const selected = cam.properties.id === selectedCameraId;
        return (
          <MapMarker key={cam.properties.id} longitude={lng} latitude={lat}>
            <MarkerContent>
              <Pin
                className={
                  selected
                    ? "scale-125 bg-amber-500 text-white ring-2 ring-amber-200"
                    : "bg-amber-400 text-amber-950"
                }
              >
                <CameraIcon className="size-3" />
              </Pin>
            </MarkerContent>
            <MarkerPopup closeButton>
              <CameraPopup camera={cam} />
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </Map>
  );
}

function Pin({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`grid size-6 place-items-center rounded-full shadow-md ring-2 ring-background transition-transform ${className}`}
    >
      {children}
    </div>
  );
}

function CameraPopup({ camera }: { camera: CameraOnRoute }) {
  const { name, imageUrl, alongM, offsetM } = camera.properties;
  // Las cámaras se refrescan en origen cada pocos minutos: rompemos la caché al montar el popup
  const [cacheBust] = useState(() => Date.now());
  return (
    <div className="w-72 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      {imageUrl && (
        <img src={`${imageUrl}?t=${cacheBust}`} alt={`Cámara ${name}`} className="aspect-[300/220] w-full bg-muted object-cover" />
      )}
      <div className="space-y-0.5 p-3">
        <p className="font-heading text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          En el km {formatKm(alongM)} de tu ruta · a {offsetM} m
        </p>
      </div>
    </div>
  );
}

/** Encaja la vista en la ruta cada vez que cambia. */
function FitToRoute({ route }: { route: Route }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const [minX, minY, maxX, maxY] = bbox(route.geometry);
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 64, duration: 800 },
    );
  }, [map, isLoaded, route]);
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
