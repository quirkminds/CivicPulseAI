import { ArrowDownRight, ChevronDown, ChevronLeft, ChevronUp, MapPinnedIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchNeighborhoodZones } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NeighborhoodLevel, NeighborhoodZone, NeighborhoodZones } from "@/lib/types";
import { BarrioMap, MISSING_COLOR, ZONE_COLORS } from "./barrio-map";

const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("es-ES", { notation: "compact" });

const METRICS = {
  income: { label: "Renta por persona", unit: "€/año", thresholds: [12_000, 16_000, 20_000, 24_000] },
  population: { label: "Población en hogares", unit: "personas", thresholds: [1_000, 10_000, 100_000, 1_000_000] },
  meanAge: { label: "Edad media", unit: "años", thresholds: [35, 40, 45, 50] },
} as const;

type Metric = keyof typeof METRICS;
const metricOptions: Metric[] = ["income", "population", "meanAge"];

const CHILDREN = {
  community: "provincias",
  province: "municipios",
  municipality: "distritos",
  district: "secciones",
  section: null,
} satisfies Record<NeighborhoodLevel, string | null>;

type Result = { data: NeighborhoodZones } | { error: string };

export function Barrio({ underHeader = false }: { underHeader?: boolean }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [path, setPath] = useState<NeighborhoodZone[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [metric, setMetric] = useState<Metric>("income");
  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: Result }>();
  const parent = path.at(-1);
  const parentId = parent?.id;
  const key = `${parentId ?? "spain"}:${retry}`;
  const result = settled?.key === key ? settled.result : undefined;
  const data = result && "data" in result ? result.data : undefined;
  const error = result && "error" in result ? result.error : undefined;
  const selected = data?.features.find(({ properties }) => properties.id === selectedId)?.properties;
  const focused = selected ?? parent;
  const childLevel = selected && CHILDREN[selected.level];
  const { label, unit, thresholds } = METRICS[metric];

  useEffect(() => {
    const controller = new AbortController();
    fetchNeighborhoodZones(parentId, controller.signal).then(
      (zones) => {
        if (!controller.signal.aborted) setSettled({ key, result: { data: zones } });
      },
      (failure: unknown) => {
        if (!controller.signal.aborted) {
          const message = failure instanceof Error ? failure.message : "Error al cargar el mapa.";
          setSettled({ key, result: { error: message } });
        }
      },
    );
    return () => controller.abort();
  }, [key, parentId]);

  function select(zone: NeighborhoodZone) {
    setSelectedId(zone.id);
    setPanelOpen(true);
  }

  function setTerritory(next: NeighborhoodZone[]) {
    setSelectedId("");
    setPath(next);
  }

  return (
    <div className="relative isolate h-full w-full overflow-hidden">
      <BarrioMap
        zones={data}
        parent={parent}
        selected={selected}
        metric={metric}
        thresholds={thresholds}
        onSelect={select}
        panelRef={panelRef}
        underHeader={underHeader}
      />
      <aside
        ref={panelRef}
        aria-label="Ficha demográfica"
        className={cn(
          "absolute inset-x-3 bottom-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] z-10 flex max-h-[44%] flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl",
          "md:right-auto md:bottom-auto md:left-4 md:max-h-[calc(100%-5rem)] md:w-80",
          underHeader ? "md:top-16" : "md:top-3",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full shrink-0 touch-manipulation justify-between px-4 md:hidden"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={() => setPanelOpen((open) => !open)}
        >
          {panelOpen ? "Plegar ficha demográfica" : "Ver ficha demográfica"}
          {panelOpen ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </Button>
        <div id={panelId} className={cn("min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 md:block md:p-5", !panelOpen && "hidden")}>
          <header className="mb-4 flex items-center gap-2.5">
            <MapPinnedIcon className="size-4 shrink-0 text-teal-300" aria-hidden />
            <h1 className="text-lg font-semibold">Mi barrio</h1>
          </header>
          <nav aria-label="Ruta territorial" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <button type="button" className="touch-manipulation underline-offset-4 hover:underline" onClick={() => setTerritory([])}>
              España
            </button>
            {path.map((zone, index) => (
              <span key={zone.id} className="inline-flex items-center gap-2">
                <span className="text-muted-foreground" aria-hidden>/</span>
                <button
                  type="button"
                  className="touch-manipulation underline-offset-4 hover:underline"
                  aria-current={index === path.length - 1 ? "location" : undefined}
                  onClick={() => setTerritory(path.slice(0, index + 1))}
                >
                  {zone.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="space-y-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Indicador del mapa
              <select
                className="h-10 w-full rounded-md border bg-background px-2.5 text-base focus-visible:outline-2 focus-visible:outline-ring"
                value={metric}
                onChange={(event) => {
                  const option = metricOptions.find((id) => id === event.target.value);
                  if (option) setMetric(option);
                }}
              >
                {metricOptions.map((id) => <option key={id} value={id}>{METRICS[id].label}</option>)}
              </select>
            </label>
            {data && (
              <label className="grid gap-1.5 text-sm font-medium">
                {parent ? `Seleccionar ${CHILDREN[parent.level] ?? "zona"}` : "Seleccionar comunidad"}
                <select
                  value={selected?.id ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-2.5 text-base focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <option value="">Selecciona una zona</option>
                  {data.features.map(({ properties }) => (
                    <option key={properties.id} value={properties.id}>{properties.name}</option>
                  ))}
                </select>
              </label>
            )}

            {!result && <output className="text-sm text-muted-foreground">Cargando zonas…</output>}
            {error && (
              <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
                <p>{error}</p>
                <Button size="sm" variant="outline" onClick={() => setRetry(retry + 1)}>Reintentar</Button>
              </div>
            )}

            {focused && (
              <div className="rounded-lg border bg-background p-3" aria-live="polite">
                <h2 className="mb-2 text-base font-semibold">{focused.name}</h2>
                <dl className="grid gap-1.5 text-sm tabular-nums">
                  <Statistic label="Renta por persona" value={focused.income} unit="€/año" />
                  <Statistic label="Población en hogares" value={focused.population} unit="personas" />
                  <Statistic label="Edad media" value={focused.meanAge} unit="años" />
                  <Statistic label="Hogares unipersonales" value={focused.singlePersonHouseholds} unit="%" />
                </dl>
                {selected && childLevel && (
                  <Button className="mt-3 w-full touch-manipulation" onClick={() => setTerritory([...path, selected])}>
                    <ArrowDownRight aria-hidden />
                    Ver {childLevel}
                  </Button>
                )}
              </div>
            )}

            {parent && (
              <Button variant="ghost" size="sm" className="touch-manipulation" onClick={() => setTerritory(path.slice(0, -1))}>
                <ChevronLeft aria-hidden />
                Volver a {path.at(-2)?.name ?? "España"}
              </Button>
            )}

            {data && (
              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p>{label} · {unit}</p>
                <div className="mt-2 flex overflow-hidden rounded-sm" aria-hidden>
                  {ZONE_COLORS.map((color) => <span key={color} className="h-2 flex-1" style={{ backgroundColor: color }} />)}
                </div>
                <div className="mt-1 grid grid-cols-5 text-center tabular-nums">
                  <span>&lt;{compact.format(thresholds[0])}</span>
                  {thresholds.map((value) => <span key={value}>≥{compact.format(value)}</span>)}
                </div>
                <p className="mt-2 flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: MISSING_COLOR }} aria-hidden />
                  Sin dato
                </p>
                <p className="mt-2">
                  <a className="underline underline-offset-2" href="https://ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177088&idp=1254735976608&menu=resultados">
                    INE · Atlas de renta {data.year}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Statistic({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value === null ? "Sin dato" : `${number.format(value)} ${unit}`}</dd>
    </div>
  );
}
