import { TrayectoMap } from "@/features/trayecto/trayecto-map";
import { CAMPUS_SUR, DEFAULT_ORIGIN } from "@/lib/campus";
import { Specimen } from "../components/specimen";
import { sampleCamerasOnRoute, sampleCorridor, sampleRoute } from "../fixtures";

export function MapPage() {
  return (
    <>
      <Specimen
        title="Trayecto en coche"
        description="El mapa real de la app: origen, destino, ruta, franja de 300 m y cámaras con foto. Pulsa una cámara."
        wide
      >
        <div className="h-[32rem] overflow-hidden rounded-2xl border">
          <TrayectoMap
            origin={DEFAULT_ORIGIN.coords}
            destination={CAMPUS_SUR.coords}
            route={sampleRoute}
            corridor={sampleCorridor}
            cameras={sampleCamerasOnRoute}
          />
        </div>
      </Specimen>

      <Specimen
        title="Cámara seleccionada"
        description="Al elegir una cámara en la lista, el mapa vuela hasta ella y el pin crece."
        wide
      >
        <div className="h-80 overflow-hidden rounded-2xl border">
          <TrayectoMap
            origin={DEFAULT_ORIGIN.coords}
            destination={CAMPUS_SUR.coords}
            route={sampleRoute}
            corridor={sampleCorridor}
            cameras={sampleCamerasOnRoute}
            selectedCameraId={sampleCamerasOnRoute[0]?.properties.id ?? null}
          />
        </div>
      </Specimen>
    </>
  );
}
