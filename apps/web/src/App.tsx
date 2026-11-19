import { HomeIcon, MapPinnedIcon, RouteIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Barrio } from "@/features/barrio/barrio";
import { CasaPanel } from "@/features/casa/casa-panel";
import { TrayectoMap } from "@/features/trayecto/trayecto-map";
import { type Mode, type TrayectoLayer, TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { useEndpoint } from "@/features/trayecto/use-endpoint";
import { useLocate } from "@/features/trayecto/use-locate";
import { useTrayecto } from "@/features/trayecto/use-trayecto";
import { USE_MOCKS } from "@/lib/api";
import { CAMPUS_SUR, CAMPUSES, DEFAULT_ORIGIN } from "@/lib/campus";
import type { Endpoint } from "@/features/trayecto/use-endpoint";
import type { Campus, LngLat } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = "trayecto" | "casa" | "barrio";

const SECTIONS: { id: Section; label: string; icon: typeof RouteIcon }[] = [
  { id: "trayecto", label: "Mi trayecto", icon: RouteIcon },
  { id: "casa", label: "Mi casa", icon: HomeIcon },
  { id: "barrio", label: "Mi barrio", icon: MapPinnedIcon },
];

export default function App() {
  const [section, setSection] = useState<Section>("trayecto");
  const origin = useEndpoint({ ...DEFAULT_ORIGIN, campusId: null });
  // Destino: un campus (atajo), una dirección buscada o un punto arrastrado en el mapa.
  const destination = useEndpoint(campusEndpoint(CAMPUS_SUR));
  const [mode, setMode] = useState<Mode>("car");
  const [activeLayer, setActiveLayer] = useState<TrayectoLayer | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ coords: LngLat; seq: number } | null>(null);

  // «Tren» lo lleva otro compañero: mientras tanto se sigue pidiendo la ruta en coche, pero no se pinta.
  const routed = section === "trayecto" && mode !== "transit";
  const { state, trip, corridor, camerasOnRoute = [] } = useTrayecto(
    origin.point.coords,
    destination.point.coords,
    mode === "transit" ? "car" : mode,
  );

  const resetFocus = () => {
    setSelectedCameraId(null);
    setFocusPoint(null);
  };
  const locator = useLocate((coords) => {
    origin.setFromMap(coords, "Mi ubicación");
    resetFocus();
  });

  const toggleLayer = (layer: TrayectoLayer) => {
    setActiveLayer((prev) => (prev === layer ? null : layer));
    if (layer !== "cameras") setSelectedCameraId(null);
  };

  const handleFocusPoint = (coords: LngLat) => {
    setFocusPoint((prev) => ({ coords, seq: (prev?.seq ?? 0) + 1 }));
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {/* Mapa a pantalla completa: permanece montado al cambiar de sección para no recargar teselas */}
      <main className={cn("absolute inset-0", section === "barrio" && "hidden")}>
        <TrayectoMap
          origin={origin.point.coords}
          destination={destination.point.coords}
          onOriginChange={
            section === "trayecto"
              ? (c) => {
                  origin.setFromMap(c);
                  resetFocus();
                }
              : undefined
          }
          onDestinationChange={
            section === "trayecto"
              ? (c) => {
                  destination.setFromMap(c);
                  resetFocus();
                }
              : undefined
          }
          route={routed ? trip?.route : undefined}
          traffic={routed ? trip?.traffic : undefined}
          stations={routed ? trip?.stations : undefined}
          incidents={routed ? trip?.incidents : undefined}
          corridor={routed && mode === "car" ? corridor : undefined}
          cameras={routed ? camerasOnRoute : []}
          activeLayer={activeLayer}
          selectedCameraId={selectedCameraId}
          focusPoint={focusPoint}
          floatingCardOffset={section !== "casa"}
        />
      </main>

      {/* Barra superior flotante estilo Vercel: marca a la izquierda y dock de secciones centrado */}
      <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 md:inset-x-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/85 px-3 py-1.5 shadow-xl backdrop-blur-xl">
          <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />
          <span className="font-heading text-sm font-semibold tracking-tight">CivicPulse</span>
          {USE_MOCKS && section !== "barrio" && (
            <Badge variant="secondary" className="hidden h-5 px-1.5 text-[10px] sm:inline-flex">
              Ejemplo
            </Badge>
          )}
        </div>

        <nav
          aria-label="Secciones"
          className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background/85 p-1 shadow-2xl backdrop-blur-xl"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                aria-label={label}
                onClick={() => setSection(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Contrapeso invisible en escritorio para centrar el dock y dejar libre top-right al selector de mapa */}
        <div className="hidden w-32 md:block" aria-hidden="true" />
      </header>

      {/* Mi trayecto: tarjeta flotante izquierda (o panel inferior en móvil) con divulgación progresiva */}
      {section === "trayecto" && (
        <aside className="absolute inset-x-3 bottom-3 z-10 flex max-h-[54dvh] flex-col overflow-y-auto rounded-2xl border bg-background/85 p-4 shadow-2xl backdrop-blur-xl md:inset-x-auto md:top-16 md:bottom-auto md:left-4 md:max-h-[calc(100dvh-5rem)] md:w-[376px]">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Vive más barato</h1>
              <p className="text-xs text-muted-foreground">y pierde menos tiempo, con datos oficiales.</p>
            </div>
          </div>

          <TrayectoPanel
            originLabel={origin.point.label}
            onOriginSelect={(place) => {
              origin.set({ coords: place.coords, label: place.name, campusId: null });
              resetFocus();
            }}
            destinationLabel={destination.point.label}
            onDestinationSelect={(place) => {
              destination.set({ coords: place.coords, label: place.name, campusId: null });
              resetFocus();
            }}
            onLocate={locator.locate}
            locating={locator.locating}
            locateError={locator.error}
            campusId={destination.point.campusId}
            onCampusChange={(id) => {
              const campus = CAMPUSES.find((c) => c.id === id);
              if (!campus) return;
              destination.set(campusEndpoint(campus));
              resetFocus();
            }}
            mode={mode}
            onModeChange={(next) => {
              setMode(next);
              setActiveLayer(null);
              setSelectedCameraId(null);
            }}
            loading={state.status === "loading"}
            error={state.status === "error" ? state.error : undefined}
            trip={trip}
            cameras={camerasOnRoute}
            activeLayer={activeLayer}
            onToggleLayer={toggleLayer}
            selectedCameraId={selectedCameraId}
            onSelectCamera={(id) => {
              setActiveLayer("cameras");
              setSelectedCameraId(id);
            }}
            onFocusPoint={handleFocusPoint}
          />
        </aside>
      )}

      {/* Mi casa: panel centrado sobre lienzo oscuro para que las gráficas de shadcn/charts respiren */}
      {section === "casa" && (
        <section className="absolute inset-0 z-10 overflow-y-auto bg-background/95 px-4 pt-20 pb-12 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <header className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Mi casa</h1>
              <p className="text-sm text-muted-foreground">
                Curva de demanda y producción en tiempo real, estado del mercado y factura estimada según tu zona del INE.
              </p>
            </header>
            <CasaPanel />
          </div>
        </section>
      )}

      {section === "barrio" && (
        <main className="absolute inset-0">
          <Barrio underHeader />
        </main>
      )}
    </div>
  );
}

function campusEndpoint(campus: Campus): Endpoint {
  return { coords: campus.coords, label: `${campus.name} (${campus.school})`, campusId: campus.id };
}
