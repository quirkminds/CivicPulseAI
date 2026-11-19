import {
  BikeIcon,
  CameraIcon,
  CarIcon,
  CheckCircle2Icon,
  ClockIcon,
  ConstructionIcon,
  EuroIcon,
  FootprintsIcon,
  FuelIcon,
  GaugeIcon,
  GraduationCapIcon,
  HomeIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  MapPinIcon,
  RouteIcon,
  SignpostIcon,
  TrainFrontIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CAMPUSES } from "@/lib/campus";
import { formatDuration, formatEur, formatKm, formatPricePerLiter, incidentLabel } from "@/lib/format";
import type { LocatedPlace } from "@/lib/geocoder";
import { trafficDelayS } from "@/lib/navigation";
import type { CameraOnRoute, LngLat, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ManeuverList } from "./maneuver-list";
import { PlaceSearch } from "./place-search";
import { StationsChart } from "./stations-chart";
import { CAMERA_CORRIDOR_M, INCIDENT_RADIUS_M, STATION_RADIUS_M } from "./use-trayecto";

export type Mode = "car" | "walk" | "bike" | "transit";
export type TrayectoLayer = "directions" | "incidents" | "stations" | "cameras";

type Props = {
  originLabel: string;
  onOriginSelect: (place: LocatedPlace) => void;
  destinationLabel: string;
  onDestinationSelect: (place: LocatedPlace) => void;
  /** Pide la ubicación actual del navegador como origen. */
  onLocate?: () => void;
  locating?: boolean;
  locateError?: string;
  /** null cuando el destino es un punto arrastrado en el mapa. */
  campusId: string | null;
  onCampusChange: (id: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  loading: boolean;
  error?: string;
  trip?: Trip;
  cameras: CameraOnRoute[];
  activeLayer: TrayectoLayer | null;
  onToggleLayer: (layer: TrayectoLayer) => void;
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onFocusPoint?: (coords: LngLat) => void;
};

export function TrayectoPanel(props: Props) {
  const { trip, cameras, loading, activeLayer } = props;
  const route = trip?.route;
  const cheapest = trip?.stations[0];
  const incidents = trip?.incidents ?? [];
  const stations = trip?.stations ?? [];
  const maneuvers = route?.maneuvers ?? [];
  const traffic = trip?.traffic;
  const delayS = route ? trafficDelayS(route) : 0;
  const isCar = props.mode === "car";
  // Sin ingesta correcta del Ayuntamiento, sus cámaras salen del fixture de respaldo de la API.
  const madridFallback =
    trip?.updatedAt["cameras-madrid"] === null && cameras.some((c) => c.properties.source === "madrid");

  return (
    <div className="flex flex-col gap-3.5">
      {/* Nivel 0: origen, destino y modo, compactos */}
      <section className="grid gap-2.5">
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1">
            <PlaceSearch
              label="Desde"
              value={props.originLabel}
              placeholder="¿Desde dónde sales?"
              icon={<HomeIcon />}
              onSelect={props.onOriginSelect}
              shortcuts={
                props.onLocate
                  ? [{ id: "locate", label: "Mi ubicación", icon: <LocateFixedIcon />, onSelect: props.onLocate }]
                  : []
              }
            />
          </div>
          {props.onLocate && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={props.onLocate}
              disabled={props.locating}
              aria-label="Usar mi ubicación como origen"
              title="Usar mi ubicación"
            >
              {props.locating ? <LoaderCircleIcon className="animate-spin" /> : <LocateFixedIcon />}
            </Button>
          )}
        </div>

        <PlaceSearch
          label="Hasta"
          value={props.destinationLabel}
          placeholder="¿Adónde vas?"
          icon={<MapPinIcon />}
          onSelect={props.onDestinationSelect}
          shortcuts={CAMPUSES.map((c) => ({
            id: c.id,
            label: c.name,
            detail: c.school,
            icon: <GraduationCapIcon />,
            onSelect: () => props.onCampusChange(c.id),
          }))}
        />

        {props.locateError ? (
          <p className="-mt-1 text-[11px] text-destructive">{props.locateError}</p>
        ) : (
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Busca una dirección o arrastra los marcadores del mapa.
          </p>
        )}

        <ToggleGroup
          type="single"
          variant="outline"
          value={props.campusId ?? ""}
          onValueChange={(v) => v && props.onCampusChange(v)}
          className="w-full"
          aria-label="Campus de destino"
        >
          {CAMPUSES.map((c) => (
            <ToggleGroupItem key={c.id} value={c.id} className="h-auto flex-1 flex-col gap-0.5 py-2 leading-tight">
              <span className="text-xs font-medium">{c.name}</span>
              <span className="text-[11px] text-muted-foreground">{c.school}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="single"
          value={props.mode}
          onValueChange={(v) => v && props.onModeChange(v as Mode)}
          className="w-full"
          variant="outline"
          size="sm"
          aria-label="Modo de transporte"
        >
          <ToggleGroupItem value="car" className="flex-1 text-xs">
            <CarIcon /> Coche
          </ToggleGroupItem>
          <ToggleGroupItem value="walk" className="flex-1 text-xs">
            <FootprintsIcon /> A pie
          </ToggleGroupItem>
          <ToggleGroupItem value="bike" className="flex-1 text-xs">
            <BikeIcon /> Bici
          </ToggleGroupItem>
          <ToggleGroupItem value="transit" className="flex-1 text-xs" aria-label="Metro / Cercanías">
            <TrainFrontIcon /> Tren
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      {props.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          {props.error}
        </p>
      )}

      {props.mode === "transit" ? (
        <Card size="sm" className="bg-card/80">
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription className="text-xs">
              Horarios del GTFS del CRTM, retrasos en vivo de Renfe (GTFS-RT) y coste con tu abono.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* Nivel 1: veredicto inmediato en 3 cifras */}
          <div className="grid grid-cols-3 divide-x divide-border rounded-xl border bg-card/80">
            <Metric icon={<EuroIcon />} label="Al mes" highlight loading={loading}>
              {trip ? (isCar ? (trip.cost ? formatEur(trip.cost.eurPerMonth) : "—") : formatEur(0)) : null}
            </Metric>
            <Metric icon={<ClockIcon />} label={isCar && delayS > 0 ? "Con tráfico" : "Tiempo"} loading={loading}>
              {route && formatDuration(route.trafficDurationS)}
            </Metric>
            <Metric icon={<RouteIcon />} label="Distancia" loading={loading}>
              {route && `${formatKm(route.distanceM)} km`}
            </Metric>
          </div>

          {!loading && route?.engine === "cartociudad" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-300">
              El motor de rutas local no responde: ruta de CartoCiudad, que no tiene en cuenta los sentidos de
              circulación ni da indicaciones.
            </p>
          )}

          {!loading && isCar && route && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {formatDuration(route.durationS)} sin tráfico
              {delayS > 0 ? (
                <>
                  {" "}
                  · <span className="font-medium text-amber-300 tabular-nums">+{formatDuration(delayS)}</span> por avisos
                  de la DGT (estimado)
                </>
              ) : (
                " · sin avisos de tráfico lento de la DGT"
              )}
              .
            </p>
          )}

          {!loading && traffic && (traffic.closuresAvoided.length > 0 || traffic.closuresOnRoute.length > 0 || traffic.slowSegments.length > 0) && (
            <ul className="grid gap-1" aria-label="Tráfico en tu ruta">
              {traffic.closuresAvoided.map((c) => (
                <TrafficRow key={`a-${c.id}`} icon={<ConstructionIcon />} onClick={() => props.onFocusPoint?.(c.position)}>
                  Ruta desviada para evitar un <strong className="font-medium text-foreground">corte total</strong> en{" "}
                  {c.road}
                </TrafficRow>
              ))}
              {traffic.closuresOnRoute.map((c) => (
                <TrafficRow key={`o-${c.id}`} icon={<ConstructionIcon />} tone="red" onClick={() => props.onFocusPoint?.(c.position)}>
                  <strong className="font-medium">Corte total</strong> en {c.road} sin alternativa: revisa la ruta
                </TrafficRow>
              ))}
              {traffic.slowSegments.map((s) => (
                <TrafficRow key={`s-${s.id}`} icon={<GaugeIcon />} onClick={() => props.onFocusPoint?.(s.position)}>
                  Tráfico lento en {s.road} · {formatKm(s.lengthM)} km ·{" "}
                  <span className="text-amber-300 tabular-nums">+{formatDuration(s.delayS)}</span>
                </TrafficRow>
              ))}
            </ul>
          )}

          {!loading && trip?.cost && cheapest && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{formatEur(trip.cost.eurPerTrip)}</span> por
              viaje ({trip.cost.litersPerTrip.toLocaleString("es-ES")} l · {trip.cost.days} días i/v) con gasolina 95 a{" "}
              <span className="font-medium text-emerald-400 tabular-nums">{formatPricePerLiter(cheapest.price)}</span>.
            </p>
          )}

          {/* Píldoras de alertas y capas: solo se muestra lo que aplica a esta ruta */}
          <section className="flex flex-col gap-2" aria-label="Alertas y capas en tu ruta">
            {loading ? (
              <div className="flex gap-1.5">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {maneuvers.length > 0 && (
                  <LayerPill
                    tone="sky"
                    active={activeLayer === "directions"}
                    onClick={() => props.onToggleLayer("directions")}
                    icon={<SignpostIcon className="size-3.5" />}
                  >
                    {maneuvers.length} indicaciones
                  </LayerPill>
                )}

                {incidents.length > 0 && (
                  <LayerPill
                    tone="red"
                    active={activeLayer === "incidents"}
                    onClick={() => props.onToggleLayer("incidents")}
                    icon={<TriangleAlertIcon className="size-3.5" />}
                  >
                    {incidents.length} {incidents.length === 1 ? "incidencia" : "incidencias"}
                  </LayerPill>
                )}

                {stations.length > 0 && cheapest && (
                  <LayerPill
                    tone="emerald"
                    active={activeLayer === "stations"}
                    onClick={() => props.onToggleLayer("stations")}
                    icon={<FuelIcon className="size-3.5" />}
                  >
                    {formatPricePerLiter(cheapest.price)}
                  </LayerPill>
                )}

                {cameras.length > 0 && (
                  <LayerPill
                    tone="amber"
                    active={activeLayer === "cameras"}
                    onClick={() => props.onToggleLayer("cameras")}
                    icon={<CameraIcon className="size-3.5" />}
                  >
                    {cameras.length} {cameras.length === 1 ? "cámara" : "cámaras"}
                  </LayerPill>
                )}

                {incidents.length === 0 && route && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-muted-foreground">
                    <CheckCircle2Icon className="size-3 text-emerald-400" /> Sin incidencias DGT
                  </span>
                )}
              </div>
            )}

            {!loading &&
              activeLayer === null &&
              (maneuvers.length > 0 || incidents.length > 0 || stations.length > 0 || cameras.length > 0) && (
              <p className="text-[11px] text-muted-foreground">
                Pulsa una alerta o capa para mostrarla en el mapa y ver el detalle.
              </p>
            )}
          </section>

          {/* Nivel 2: detalle bajo demanda, solo cuando el usuario abre una capa */}
          {!loading && activeLayer === "directions" && (
            <DetailDrawer
              title="Indicaciones"
              subtitle="pulsa un paso para verlo en el mapa"
              onClose={() => props.onToggleLayer("directions")}
            >
              <ManeuverList maneuvers={maneuvers} onFocusPoint={props.onFocusPoint} />
            </DetailDrawer>
          )}

          {!loading && activeLayer === "incidents" && (
            <DetailDrawer
              title="Incidencias DGT"
              subtitle={`a menos de ${INCIDENT_RADIUS_M} m`}
              onClose={() => props.onToggleLayer("incidents")}
            >
              {incidents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin incidencias en tu ruta.</p>
              ) : (
                <ul className="grid gap-1">
                  {incidents.map((inc) => (
                    <li key={inc.id}>
                      <button
                        type="button"
                        onClick={() => props.onFocusPoint?.(inc.position)}
                        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-xs transition-colors hover:bg-muted"
                      >
                        <Badge
                          variant="outline"
                          className="w-14 justify-center border-red-500/30 text-red-400 tabular-nums"
                        >
                          km {formatKm(inc.alongM)}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-foreground">{incidentLabel(inc.cause)}</span> ·{" "}
                          <span className="text-muted-foreground">{inc.road}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DetailDrawer>
          )}

          {!loading && activeLayer === "stations" && (
            <DetailDrawer
              title="Gasolineras más baratas"
              subtitle={`a menos de ${formatKm(STATION_RADIUS_M)} km`}
              onClose={() => props.onToggleLayer("stations")}
            >
              {stations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay gasolineras cerca de esta ruta.</p>
              ) : (
                <div className="grid gap-2.5">
                  <StationsChart stations={stations} />
                  <ul className="grid gap-1">
                    {stations.slice(0, 5).map((st, index) => (
                      <li key={st.id}>
                        <button
                          type="button"
                          onClick={() => props.onFocusPoint?.(st.position)}
                          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-muted"
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              "tabular-nums",
                              index === 0
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                : "border-blue-500/30 text-blue-300",
                            )}
                          >
                            {formatPricePerLiter(st.price)}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-foreground">{st.brand}</span> ·{" "}
                            <span className="text-muted-foreground">{st.address}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DetailDrawer>
          )}

          {!loading && activeLayer === "cameras" && (
            <DetailDrawer
              title={`Cámaras en tu ruta (${cameras.length})`}
              subtitle={`a menos de ${CAMERA_CORRIDOR_M} m`}
              onClose={() => props.onToggleLayer("cameras")}
            >
              {madridFallback && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Las cámaras del Ayuntamiento son de una copia del 19/11: su servidor no responde ahora mismo.
                </p>
              )}
              {cameras.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay cámaras cerca de esta ruta.</p>
              ) : (
                <ul className="grid max-h-56 gap-1 overflow-y-auto pr-1">
                  {cameras.map((cam) => {
                    const selected = cam.properties.id === props.selectedCameraId;
                    return (
                      <li key={cam.properties.id}>
                        <button
                          type="button"
                          onClick={() => props.onSelectCamera(cam.properties.id)}
                          data-selected={selected}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-muted",
                            selected && "bg-amber-500/15 ring-1 ring-amber-500/30",
                          )}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-14 justify-center tabular-nums",
                              selected ? "border-amber-400/50 text-amber-300" : "border-amber-500/25 text-amber-400/90",
                            )}
                          >
                            km {formatKm(cam.properties.alongM)}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate">{cam.properties.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DetailDrawer>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  highlight = false,
  loading,
  children,
}: {
  icon: ReactNode;
  label: string;
  highlight?: boolean;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </span>
      {loading ? (
        <Skeleton className="mt-0.5 h-5 w-14" />
      ) : (
        <span
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            highlight ? "text-foreground" : "text-foreground/90",
          )}
        >
          {children}
        </span>
      )}
    </div>
  );
}

const PILL_TONES = {
  sky: {
    idle: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
    active: "border-sky-400/60 bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40",
  },
  red: {
    idle: "border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/20",
    active: "border-red-400/60 bg-red-500/25 text-red-200 ring-1 ring-red-400/40",
  },
  emerald: {
    idle: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    active: "border-emerald-400/60 bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40",
  },
  amber: {
    idle: "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
    active: "border-amber-400/60 bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/40",
  },
} as const;

function LayerPill({
  tone,
  active,
  onClick,
  icon,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? PILL_TONES[tone].active : PILL_TONES[tone].idle,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function TrafficRow({
  icon,
  tone = "amber",
  onClick,
  children,
}: {
  icon: ReactNode;
  tone?: "amber" | "red";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
          tone === "red"
            ? "border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20"
            : "border-amber-500/25 bg-amber-500/5 text-muted-foreground hover:bg-amber-500/10",
        )}
      >
        <span className={tone === "red" ? "text-red-400" : "text-amber-400"}>{icon}</span>
        <span className="min-w-0 flex-1">{children}</span>
      </button>
    </li>
  );
}

function DetailDrawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/90 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-semibold tracking-tight">{title}</h2>
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        </div>
        <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label={`Cerrar ${title}`}>
          <XIcon />
        </Button>
      </div>
      {children}
    </section>
  );
}
