import { ClockIcon, EuroIcon, LeafIcon } from "lucide-react";
import type { ReactNode } from "react";
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
import { TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { BothSurfaces, Specimen, Surface } from "../components/specimen";
import { sampleCamerasOnRoute, sampleRoute } from "../fixtures";

const badgeVariants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;

const noop = () => {};

export function DataPage() {
  return (
    <>
      <Specimen title="Badge" description="Etiquetas cortas: «Datos de ejemplo», km de cada cámara.">
        <BothSurfaces>
          {badgeVariants.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
          <Badge variant="outline" className="w-14 justify-center tabular-nums">
            km 4,2
          </Badge>
        </BothSurfaces>
      </Specimen>

      <Specimen title="Card" description="Anatomía completa y el tamaño sm que usan las estadísticas.">
        <BothSurfaces className="items-start">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Coche</CardTitle>
              <CardDescription>Sol → Campus Sur, ida y vuelta</CardDescription>
              <CardAction>
                <Badge variant="secondary">Más rápido</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <Figure icon={<EuroIcon />} label="Al mes" value="88,8 €" />
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
        </BothSurfaces>
      </Specimen>

      <Specimen title="Separator" description="Divide bloques sin añadir peso.">
        <BothSurfaces className="flex-col items-stretch">
          <p className="text-sm">Coche</p>
          <Separator />
          <p className="text-sm">Metro / Cercanías</p>
        </BothSurfaces>
      </Specimen>

      <Specimen
        title="Panel de «Mi trayecto»"
        description="El componente real de la app con los datos de ejemplo: estadísticas, lista de cámaras y selección."
      >
        {(["light", "dark"] as const).map((tone) => (
          <Surface key={tone} tone={tone} className="block">
            <TrayectoPanel
              originLabel={DEFAULT_ORIGIN.label}
              campusId={CAMPUS_SUR.id}
              onCampusChange={noop}
              mode="car"
              onModeChange={noop}
              loading={false}
              route={sampleRoute}
              cameras={sampleCamerasOnRoute.slice(0, 5)}
              selectedCameraId={sampleCamerasOnRoute[1]?.properties.id ?? null}
              onSelectCamera={noop}
            />
          </Surface>
        ))}
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
