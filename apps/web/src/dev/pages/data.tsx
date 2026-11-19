import { ClockIcon, EuroIcon, LeafIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ManeuverList } from "@/features/trayecto/maneuver-list";
import { type TrayectoLayer, TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { Specimen, Surface } from "../components/specimen";
import { sampleCamerasOnRoute, sampleTrip, sampleTripWithTraffic, sampleWalkTrip } from "../fixtures";

const badgeVariants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;

const noop = () => {};

export function DataPage() {
  const [activeLayer, setActiveLayer] = useState<TrayectoLayer | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  return (
    <>
      <Specimen title="Badge" description="Etiquetas cortas: «Ejemplo», precios €/l y km de cada cámara.">
        <Surface>
          {badgeVariants.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
          <Badge variant="outline" className="w-14 justify-center tabular-nums">
            km 4,2
          </Badge>
        </Surface>
      </Specimen>

      <Specimen title="Card" description="Anatomía completa sobre superficie oscura.">
        <Surface className="items-start">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Coche</CardTitle>
              <CardDescription>Sol → Campus Sur, ida y vuelta</CardDescription>
              <CardAction>
                <Badge variant="secondary">Más rápido</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <Figure icon={<EuroIcon />} label="Al mes" value="28,84 €" />
              <Figure icon={<ClockIcon />} label="Al día" value="24 min" />
              <Figure icon={<LeafIcon />} label="CO₂ / mes" value="42 kg" />
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted-foreground">Cifras de ejemplo</span>
              <Button size="sm" variant="outline">
                Ver detalle
              </Button>
            </CardFooter>
          </Card>
        </Surface>
      </Specimen>

      <Specimen title="Separator" description="Divide bloques sin añadir peso.">
        <Surface className="flex-col items-stretch">
          <p className="text-sm">Coche</p>
          <Separator />
          <p className="text-sm">Metro / Cercanías</p>
        </Surface>
      </Specimen>

      <Specimen
        title="Indicaciones paso a paso"
        description="Maniobras de Valhalla en castellano (Sol → Campus Sur en coche). Icono por tipo de giro y distancia hasta el siguiente paso; al pulsar uno, el mapa vuela a él."
      >
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-3">
            <ManeuverList maneuvers={sampleTrip.route.maneuvers.slice(0, 12)} />
          </div>
        </Surface>
      </Specimen>

      <Specimen
        title="Panel con avisos de la DGT"
        description="Tiempo con tráfico (estimado), corte total esquivado y tramo lento con su retraso. Cada aviso lleva al punto en el mapa."
      >
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-4">
            <TrayectoPanel
              originLabel={DEFAULT_ORIGIN.label}
              onOriginSelect={noop}
              destinationLabel={`${CAMPUS_SUR.name} (${CAMPUS_SUR.school})`}
              onDestinationSelect={noop}
              onLocate={noop}
              campusId={CAMPUS_SUR.id}
              onCampusChange={noop}
              mode="car"
              onModeChange={noop}
              loading={false}
              trip={sampleTripWithTraffic}
              cameras={[]}
              activeLayer={null}
              onToggleLayer={noop}
              selectedCameraId={null}
              onSelectCamera={noop}
            />
          </div>
        </Surface>
      </Specimen>

      <Specimen
        title="Panel a pie"
        description="Sin coste, gasolineras ni cámaras: tiempo, distancia e indicaciones. Destino arrastrado en el mapa (ningún campus marcado)."
      >
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-4">
            <TrayectoPanel
              originLabel="Mi ubicación"
              onOriginSelect={noop}
              destinationLabel="Calle Atocha"
              onDestinationSelect={noop}
              onLocate={noop}
              campusId={null}
              onCampusChange={noop}
              mode="walk"
              onModeChange={noop}
              loading={false}
              trip={sampleWalkTrip}
              cameras={[]}
              activeLayer="directions"
              onToggleLayer={noop}
              selectedCameraId={null}
              onSelectCamera={noop}
            />
          </div>
        </Surface>
      </Specimen>

      <Specimen
        title="Panel de «Mi trayecto» (divulgación progresiva)"
        description="Empieza limpio (solo veredicto y píldoras). Pulsa una alerta o capa para desplegar su detalle y gráfica."
      >
        <Surface className="block">
          <div className="max-w-sm rounded-2xl border bg-background/85 p-4">
            <TrayectoPanel
              originLabel={DEFAULT_ORIGIN.label}
              onOriginSelect={noop}
              destinationLabel={`${CAMPUS_SUR.name} (${CAMPUS_SUR.school})`}
              onDestinationSelect={noop}
              campusId={CAMPUS_SUR.id}
              onCampusChange={noop}
              mode="car"
              onModeChange={noop}
              loading={false}
              trip={sampleTrip}
              cameras={sampleCamerasOnRoute.slice(0, 8)}
              activeLayer={activeLayer}
              onToggleLayer={(layer) => setActiveLayer((prev) => (prev === layer ? null : layer))}
              selectedCameraId={selectedCameraId}
              onSelectCamera={setSelectedCameraId}
            />
          </div>
        </Surface>
      </Specimen>
    </>
  );
}

function Figure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="font-heading text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
