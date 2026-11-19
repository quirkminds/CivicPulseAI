import { CarIcon, HomeIcon, MapPinnedIcon, RouteIcon, TrainFrontIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CAMPUSES, CAMPUS_SUR } from "@/lib/campus";
import { BothSurfaces, Specimen } from "../components/specimen";

/** Etiqueta y campo. useId evita ids repetidos al pintar el mismo ejemplo en claro y en oscuro. */
function OriginField({ invalid = false, disabled = false }: { invalid?: boolean; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={id}>Desde</Label>
      <Input
        id={id}
        placeholder="Calle, número, municipio"
        defaultValue={invalid ? "Calle que no existe" : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
      />
    </div>
  );
}

export function ControlsPage() {
  return (
    <>
      <Specimen title="Campo de texto" description="Origen del trayecto: normal, inválido y deshabilitado.">
        <BothSurfaces className="flex-col items-stretch">
          <OriginField />
          <OriginField invalid />
          <OriginField disabled />
        </BothSurfaces>
      </Specimen>

      <Specimen title="Elegir campus" description="ToggleGroup outline con dos líneas, como en el panel.">
        <BothSurfaces>
          <ToggleGroup type="single" variant="outline" defaultValue={CAMPUS_SUR.id} className="w-full">
            {CAMPUSES.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} className="flex-1 flex-col py-6 leading-tight">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.school}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </BothSurfaces>
      </Specimen>

      <Specimen title="Modo de transporte" description="ToggleGroup outline con icono.">
        <BothSurfaces>
          <ToggleGroup type="single" variant="outline" defaultValue="car" className="w-full">
            <ToggleGroupItem value="car" className="flex-1">
              <CarIcon /> Coche
            </ToggleGroupItem>
            <ToggleGroupItem value="transit" className="flex-1">
              <TrainFrontIcon /> Metro / Cercanías
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" defaultValue="car">
            <ToggleGroupItem value="car" aria-label="Coche">
              <CarIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="transit" aria-label="Metro / Cercanías">
              <TrainFrontIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </BothSurfaces>
      </Specimen>

      <Specimen title="Pestañas" description="Navegación entre secciones. Variante default y line.">
        <BothSurfaces className="flex-col items-stretch">
          {(["default", "line"] as const).map((variant) => (
            <Tabs key={variant} defaultValue="trayecto">
              <TabsList variant={variant} className="w-full">
                <TabsTrigger value="trayecto">
                  <RouteIcon /> Mi trayecto
                </TabsTrigger>
                <TabsTrigger value="casa">
                  <HomeIcon /> Mi casa
                </TabsTrigger>
                <TabsTrigger value="barrio">
                  <MapPinnedIcon /> Mi barrio
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ))}
        </BothSurfaces>
      </Specimen>

      <Specimen title="Tooltip" description="Se abre en un portal, así que siempre usa el tema de la página.">
        <BothSurfaces>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Pasa por encima</Button>
            </TooltipTrigger>
            <TooltipContent>Tiempo sin tráfico, con velocidades fijas</TooltipContent>
          </Tooltip>
        </BothSurfaces>
      </Specimen>
    </>
  );
}
