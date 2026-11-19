import { CameraIcon, CarIcon, ClockIcon, RouteIcon, TrainFrontIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CAMPUSES } from "@/lib/campus";
import { formatDuration, formatKm } from "@/lib/format";
import type { CameraOnRoute, Route } from "@/lib/types";
import { CAMERA_CORRIDOR_M } from "./use-trayecto";

export type Mode = "car" | "transit";

type Props = {
  originLabel: string;
  campusId: string;
  onCampusChange: (id: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  loading: boolean;
  error?: string;
  route?: Route;
  cameras: CameraOnRoute[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
};

export function TrayectoPanel(props: Props) {
  const { route, cameras, loading } = props;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="origin">Desde</Label>
          {/* TODO: geocodificar con CartoCiudad (/services/api/geocoder/candidatesJsonp) vía la API */}
          <Input id="origin" value={props.originLabel} readOnly />
        </div>
        <div className="grid gap-1.5">
          <Label>Hasta</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={props.campusId}
            onValueChange={(v) => v && props.onCampusChange(v)}
            className="w-full"
          >
            {CAMPUSES.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} className="flex-1 flex-col py-6 leading-tight">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.school}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ToggleGroup
          type="single"
          value={props.mode}
          onValueChange={(v) => v && props.onModeChange(v as Mode)}
          className="w-full"
          variant="outline"
        >
          <ToggleGroupItem value="car" className="flex-1">
            <CarIcon /> Coche
          </ToggleGroupItem>
          <ToggleGroupItem value="transit" className="flex-1">
            <TrainFrontIcon /> Metro / Cercanías
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      {props.error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{props.error}</p>
      )}

      {props.mode === "transit" ? (
        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>
              Horarios del GTFS del CRTM, retrasos en vivo de Renfe (GTFS-RT) y coste con tu abono.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<RouteIcon />} label="Distancia" loading={loading}>
              {route && `${formatKm(route.distanceM)} km`}
            </Stat>
            <Stat icon={<ClockIcon />} label="Sin tráfico" loading={loading}>
              {route && formatDuration(route.durationS)}
            </Stat>
            <Stat icon={<CameraIcon />} label="Cámaras" loading={loading}>
              {route && cameras.length}
            </Stat>
          </div>

          <section className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Cámaras en tu ruta</h2>
              <span className="text-xs text-muted-foreground">a menos de {CAMERA_CORRIDOR_M} m</span>
            </div>
            {loading ? (
              <Skeleton className="h-24" />
            ) : cameras.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cámaras cerca de esta ruta.</p>
            ) : (
              <ul className="grid gap-1">
                {cameras.map((cam) => (
                  <li key={cam.properties.id}>
                    <button
                      type="button"
                      onClick={() => props.onSelectCamera(cam.properties.id)}
                      data-selected={cam.properties.id === props.selectedCameraId}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted data-[selected=true]:bg-muted"
                    >
                      <Badge variant="outline" className="w-14 justify-center tabular-nums">
                        km {formatKm(cam.properties.alongM)}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{cam.properties.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  loading,
  children,
}: {
  icon: ReactNode;
  label: string;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <span className="flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3.5">
          {icon}
          {label}
        </span>
        {loading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <span className="font-heading text-lg font-semibold tabular-nums">{children}</span>
        )}
      </CardContent>
    </Card>
  );
}
