import { HomeIcon, MapPinnedIcon, RouteIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrayectoMap } from "@/features/trayecto/trayecto-map";
import { type Mode, TrayectoPanel } from "@/features/trayecto/trayecto-panel";
import { useTrayecto } from "@/features/trayecto/use-trayecto";
import { USE_MOCKS } from "@/lib/api";
import { CAMPUS_SUR, CAMPUSES, DEFAULT_ORIGIN } from "@/lib/campus";

export default function App() {
  const [campusId, setCampusId] = useState(CAMPUS_SUR.id);
  const [mode, setMode] = useState<Mode>("car");
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const campus = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUS_SUR;
  const { state, corridor, camerasOnRoute = [] } = useTrayecto(DEFAULT_ORIGIN.coords, campus.coords);
  const route = state.status === "ready" ? state.route : undefined;

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      <aside className="flex max-h-[55dvh] w-full shrink-0 flex-col overflow-y-auto border-b md:max-h-none md:w-[400px] md:border-r md:border-b-0">
        <header className="flex items-start justify-between gap-2 px-4 pt-5 pb-3">
          <div>
            <h1 className="text-xl font-semibold">Vive más barato</h1>
            <p className="text-sm text-muted-foreground">y pierde menos tiempo, con datos oficiales.</p>
          </div>
          {USE_MOCKS && <Badge variant="secondary">Datos de ejemplo</Badge>}
        </header>

        <Tabs defaultValue="trayecto" className="flex-1 px-4 pb-6">
          <TabsList className="w-full">
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

          <TabsContent value="trayecto" className="pt-3">
            <TrayectoPanel
              originLabel={DEFAULT_ORIGIN.label}
              campusId={campusId}
              onCampusChange={(id) => {
                setCampusId(id);
                setSelectedCameraId(null);
              }}
              mode={mode}
              onModeChange={setMode}
              loading={state.status === "loading"}
              error={state.status === "error" ? state.error : undefined}
              route={route}
              cameras={camerasOnRoute}
              selectedCameraId={selectedCameraId}
              onSelectCamera={setSelectedCameraId}
            />
          </TabsContent>
          <TabsContent value="casa" className="pt-3 text-sm text-muted-foreground">
            Horas más baratas de la luz (PVPC de REE) y ahorro mensual. Próximamente.
          </TabsContent>
          <TabsContent value="barrio" className="pt-3 text-sm text-muted-foreground">
            Peso del transporte y la energía sobre la renta de tu zona (INE). Próximamente.
          </TabsContent>
        </Tabs>
      </aside>

      <main className="relative min-h-0 flex-1">
        <TrayectoMap
          origin={DEFAULT_ORIGIN.coords}
          destination={campus.coords}
          route={mode === "car" ? route : undefined}
          corridor={mode === "car" ? corridor : undefined}
          cameras={mode === "car" ? camerasOnRoute : []}
          selectedCameraId={selectedCameraId}
        />
      </main>
    </div>
  );
}
