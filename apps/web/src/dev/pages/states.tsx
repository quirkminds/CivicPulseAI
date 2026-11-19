import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { Specimen, Surface } from "../components/specimen";
import { sampleTrip } from "../fixtures";

const noop = () => {};

/** Props comunes del panel; cada ejemplo cambia solo lo que enseña. */
const panelProps = {
  originLabel: DEFAULT_ORIGIN.label,
  onOriginSelect: noop,
  destinationLabel: `${CAMPUS_SUR.name} (${CAMPUS_SUR.school})`,
  onDestinationSelect: noop,
  campusId: CAMPUS_SUR.id,
  onCampusChange: noop,
  onModeChange: noop,
  activeLayer: null,
  onToggleLayer: noop,
  selectedCameraId: null,
  onSelectCamera: noop,
} as const;

export function StatesPage() {
  return (
    <>
      <Specimen title="Skeleton" description="Ocupa el mismo hueco que el contenido para que nada salte al cargar.">
        <Surface className="flex-col items-stretch">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24" />
        </Surface>
      </Specimen>

      <Specimen title="Error" description="Mensaje en línea con destructive al 10 %.">
        <Surface className="flex-col items-stretch">
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            CartoCiudad no responde ahora mismo.
          </p>
        </Surface>
      </Specimen>

      <Specimen title="Próximamente" description="Secciones que aún no tienen datos.">
        <Surface className="flex-col items-stretch">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Próximamente</CardTitle>
              <CardDescription>
                Horarios del GTFS del CRTM, retrasos en vivo de Renfe (GTFS-RT) y coste con tu abono.
              </CardDescription>
            </CardHeader>
          </Card>
        </Surface>
      </Specimen>

      <Specimen title="Panel cargando" description="Lo que se ve mientras llegan la ruta y las capas.">
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-4">
            <TrayectoPanel {...panelProps} mode="car" loading cameras={[]} />
          </div>
        </Surface>
      </Specimen>

      <Specimen
        title="Panel sin alertas ni capas cerca"
        description="Ruta encontrada sin incidencias, gasolineras ni cámaras cerca: muestra «Sin incidencias DGT» sin ruido."
      >
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-4">
            <TrayectoPanel
              {...panelProps}
              mode="car"
              loading={false}
              trip={{ ...sampleTrip, cost: null, stations: [], incidents: [], cameras: [] }}
              cameras={[]}
            />
          </div>
        </Surface>
      </Specimen>
    </>
  );
}
