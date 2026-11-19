import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrayectoMap } from "@/features/trayecto/trayecto-map";
import type { TrayectoLayer } from "@/features/trayecto/trayecto-panel";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { Specimen } from "../components/specimen";
import type { LngLat } from "@/lib/types";
import { sampleCamerasOnRoute, sampleCorridor, sampleRoute, sampleTrip, sampleWalkTrip } from "../fixtures";

export function MapPage() {
  const [layer, setLayer] = useState<TrayectoLayer | "none">("none");
  const [origin, setOrigin] = useState<LngLat>(DEFAULT_ORIGIN.coords);
  const [destination, setDestination] = useState<LngLat>(CAMPUS_SUR.coords);

  return (
    <>
      <Specimen
        title="A pie, con marcadores arrastrables"
        description="Ruta de Valhalla a pie (color propio por modo). Origen y destino se arrastran; aquí solo se mueven los marcadores, en la app se recalcula la ruta."
      >
        <div className="h-80 overflow-hidden rounded-2xl border">
          <TrayectoMap
            origin={origin}
            destination={destination}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            route={sampleWalkTrip.route}
            cameras={[]}
            activeLayer={null}
          />
        </div>
      </Specimen>

      <Specimen
        title="Trayecto en coche (capas bajo demanda)"
        description="Por defecto solo muestra ruta y alertas DGT. Cambia de capa para encender gasolineras o cámaras con la franja de 300 m."
      >
        <div className="flex flex-col gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={layer}
            onValueChange={(v) => v && setLayer(v as TrayectoLayer | "none")}
          >
            <ToggleGroupItem value="none">Solo ruta + alertas</ToggleGroupItem>
            <ToggleGroupItem value="incidents">Incidencias DGT</ToggleGroupItem>
            <ToggleGroupItem value="stations">Gasolineras</ToggleGroupItem>
            <ToggleGroupItem value="cameras">Cámaras + 300 m</ToggleGroupItem>
          </ToggleGroup>
          <div className="h-[32rem] overflow-hidden rounded-2xl border">
            <TrayectoMap
              origin={DEFAULT_ORIGIN.coords}
              destination={CAMPUS_SUR.coords}
              route={sampleRoute}
              corridor={sampleCorridor}
              stations={sampleTrip.stations}
              incidents={sampleTrip.incidents}
              cameras={sampleCamerasOnRoute}
              activeLayer={layer === "none" ? null : layer}
            />
          </div>
        </div>
      </Specimen>

      <Specimen
        title="Cámara seleccionada"
        description="Al elegir una cámara en la lista, el mapa enciende la capa y vuela hasta ella."
      >
        <div className="h-80 overflow-hidden rounded-2xl border">
          <TrayectoMap
            origin={DEFAULT_ORIGIN.coords}
            destination={CAMPUS_SUR.coords}
            route={sampleRoute}
            corridor={sampleCorridor}
            cameras={sampleCamerasOnRoute}
            activeLayer="cameras"
            selectedCameraId={sampleCamerasOnRoute[0]?.properties.id ?? null}
          />
        </div>
      </Specimen>
    </>
  );
}
