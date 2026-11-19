import { TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { BothSurfaces, Specimen, Surface } from "../components/specimen";
import { sampleRoute } from "../fixtures";

const noop = () => {};

/** Props comunes del panel; cada ejemplo cambia solo lo que enseña. */
const panelProps = {
  originLabel: DEFAULT_ORIGIN.label,
  campusId: CAMPUS_SUR.id,
  onCampusChange: noop,
  onModeChange: noop,
  selectedCameraId: null,
  onSelectCamera: noop,
} as const;

export function StatesPage() {
  return (
    <>
      <Specimen title="Skeleton" description="Ocupa el mismo hueco que el contenido para que nada salte al cargar.">
        <BothSurfaces className="flex-col items-stretch">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24" />
        </BothSurfaces>
      </Specimen>

      <Specimen title="Error" description="Mensaje en línea con destructive al 10 %.">
        <BothSurfaces className="flex-col items-stretch">
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            502 Bad Gateway en /v1/route
          </p>
        </BothSurfaces>
      </Specimen>

      <Specimen title="Próximamente" description="Secciones que aún no tienen datos.">
        <BothSurfaces className="flex-col items-stretch">
          <Card>
            <CardHeader>
              <CardTitle>Próximamente</CardTitle>
              <CardDescription>
                Horarios del GTFS del CRTM, retrasos en vivo de Renfe (GTFS-RT) y coste con tu abono.
              </CardDescription>
            </CardHeader>
          </Card>
        </BothSurfaces>
      </Specimen>

      <Specimen title="Panel cargando" description="Lo que se ve mientras llegan la ruta y las cámaras.">
        {(["light", "dark"] as const).map((tone) => (
          <Surface key={tone} tone={tone} className="block">
            <TrayectoPanel {...panelProps} mode="car" loading cameras={[]} />
          </Surface>
        ))}
      </Specimen>

      <Specimen title="Panel sin cámaras" description="Ruta encontrada pero sin cámaras en la franja.">
        {(["light", "dark"] as const).map((tone) => (
          <Surface key={tone} tone={tone} className="block">
            <TrayectoPanel {...panelProps} mode="car" loading={false} route={sampleRoute} cameras={[]} />
          </Surface>
        ))}
      </Specimen>
    </>
  );
}
