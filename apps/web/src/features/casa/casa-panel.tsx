import {
  ActivityIcon,
  FactoryIcon,
  LeafIcon,
  MapPinIcon,
  PlugZapIcon,
  TrendingDownIcon,
  WashingMachineIcon,
  ZapIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  explainExtremes,
  flowsSentence,
  HOUSEHOLD_PROFILES,
  type HouseholdProfile,
  marketPriceStatus,
  PERIODS,
  TECHS,
  WASHER_KWH,
  washerExample,
  zoneElectricityImpact,
} from "@/lib/energy";
import { formatEur, formatEurPerKwh, formatGw, formatHour, formatPercent } from "@/lib/format";
import type { ElectricityNow, ElectricityToday, TariffPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GenerationChart } from "./generation-chart";
import { PriceChart } from "./price-chart";
import { useCasa } from "./use-casa";
import { useResidenceZone } from "./use-residence-zone";

const RENEWABLE_BAR = "bg-chart-1";
const OTHER_BAR = "bg-chart-4";

/** «Mi casa»: impacto en tu zona (INE), estado del mercado (¿paga la red?) y curvas de generación y precio (ESIOS). */
export function CasaPanel() {
  const { now, today } = useCasa();
  const residence = useResidenceZone();
  const [profileId, setProfileId] = useState<HouseholdProfile["id"]>("student");
  const [mountedAt] = useState(() => Date.now());

  const profile = HOUSEHOLD_PROFILES.find((p) => p.id === profileId) ?? HOUSEHOLD_PROFILES[0];
  const nowData = now.status === "ready" ? now.data : undefined;
  const todayData = today.status === "ready" ? today.data : undefined;

  const currentHour = todayData ? hourIndex(todayData, nowData ? Date.parse(nowData.at) : mountedAt) : 0;
  const marketStatus = todayData ? marketPriceStatus(todayData, currentHour) : null;
  const impact = todayData && profile ? zoneElectricityImpact(todayData, residence.zone, profile.kwhPerMonth) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Contexto personal: zona de residencia (INE ADRH) + perfil de consumo */}
      <section className="grid gap-3 rounded-2xl border bg-card/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Tu zona de residencia</h2>
            <Badge variant="outline" className="h-5 text-[10px]">
              {residence.fromApi ? "INE ADRH · en vivo" : "INE ADRH"}
            </Badge>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={profileId}
            onValueChange={(v) => v && setProfileId(v as HouseholdProfile["id"])}
            aria-label="Consumo mensual estimado"
          >
            {HOUSEHOLD_PROFILES.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id} className="text-xs">
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Zona estadística (INE)
            <select
              value={residence.selectedId}
              onChange={(e) => residence.setSelectedId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {residence.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                  {z.income ? ` · renta media ${formatEur(z.income)}/año` : ""}
                </option>
              ))}
            </select>
          </label>

          {residence.zone.singlePersonHouseholds !== null && (
            <p className="text-xs text-muted-foreground sm:pb-2">
              Hogares de 1 persona:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatPercent(residence.zone.singlePersonHouseholds)}
              </span>
            </p>
          )}
        </div>

        {impact && (
          <div className="grid grid-cols-3 divide-x divide-border rounded-xl border bg-background/60">
            <ZoneMetric label="Factura estimada" value={`${formatEur(impact.monthlyEurAvg)}/mes`} />
            <ZoneMetric
              label="Ahorro en valle"
              value={`−${formatEur(impact.monthlySavingEur)}/mes`}
              accent="emerald"
            />
            <ZoneMetric
              label="Peso en tu renta"
              value={impact.incomeSharePct !== null ? formatPercent(impact.incomeSharePct) : "—"}
              sub={impact.monthlyIncomeEur !== null ? `de ${formatEur(impact.monthlyIncomeEur)}/mes` : undefined}
            />
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          La red peninsular y el PVPC 2.0TD son comunes para toda la península (ESIOS); el peso sobre tu presupuesto se
          ajusta a la renta neta media de tu zona según el Atlas del INE.
        </p>
      </section>

      {/* 2. Estado en tiempo real: ¿la red está pagando por consumir ahora? + 4 KPIs */}
      <section className="grid gap-3">
        <SectionTitle
          title="Estado de la red y del precio ahora"
          aside={nowData ? `Península · ${formatHour(nowData.at)}` : undefined}
        />

        {(now.status === "error" || today.status === "error") && (
          <ErrorNote>{now.status === "error" ? now.error : today.status === "error" ? today.error : ""}</ErrorNote>
        )}

        {today.status === "loading" ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          marketStatus && <MarketAlertBanner status={marketStatus} />
        )}

        {now.status === "loading" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : (
          nowData && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                icon={<ZapIcon />}
                label="Precio PVPC ahora"
                sub={marketStatus?.current.period ? PERIODS[marketStatus.current.period].label : undefined}
              >
                {marketStatus ? formatEurPerKwh(marketStatus.current.price) : "—"}
              </Stat>
              <Stat icon={<LeafIcon />} label="Renovable ahora" accent="emerald">
                {formatPercent(nowData.renewableShare)}
              </Stat>
              <Stat
                icon={<ActivityIcon />}
                label="Producción / Demanda"
                sub={
                  nowData.generationMw > nowData.demandMw
                    ? `+${formatGw(nowData.generationMw - nowData.demandMw)} sobrantes`
                    : undefined
                }
              >
                {formatGw(nowData.generationMw)} / {formatGw(nowData.demandMw)}
              </Stat>
              <Stat icon={<FactoryIcon />} label="Emisiones CO₂">
                {nowData.co2GramsPerKwh} g/kWh
              </Stat>
            </div>
          )
        )}
      </section>

      {/* 3. Curva de demanda y producción en tiempo real (inspirada en REE) */}
      <section className="grid gap-3">
        <SectionTitle title="Curva de demanda y producción hoy" aside="Áreas apiladas · MW → GW" />
        {today.status === "loading" ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : (
          todayData && <GenerationChart today={todayData} now={nowData} />
        )}
      </section>

      {/* 4. Precio horario PVPC 2.0TD y mejores franjas */}
      <section className="grid gap-3">
        <SectionTitle title="Precio del consumo hoy" aside="PVPC 2.0TD · €/kWh" />
        {today.status === "loading" ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          todayData && <TodayPriceSection today={todayData} currentHour={currentHour} />
        )}
      </section>

      {/* 5. Detalle bajo demanda: mezcla actual por tecnología */}
      {nowData && <NowMixSection now={nowData} />}

      <p className="text-xs text-muted-foreground">
        Fuentes oficiales: ESIOS y REData (Red Eléctrica de España) para red en tiempo real (cada 5 min) y PVPC 2.0TD;
        INE (Atlas de Distribución de Renta de los Hogares) para los datos de tu zona.
      </p>
    </div>
  );
}

function MarketAlertBanner({ status }: { status: NonNullable<ReturnType<typeof marketPriceStatus>> }) {
  const positive = status.kind === "paying" || status.kind === "free-energy";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-4",
        positive ? "border-emerald-500/35 bg-emerald-500/10" : "border-border bg-card/80",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              positive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400",
            )}
            aria-hidden="true"
          />
          <p className={cn("font-heading text-sm font-semibold", positive ? "text-emerald-200" : "text-foreground")}>
            {status.headline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {status.negativeHours.length > 0 && (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300 tabular-nums">
              <TrendingDownIcon className="size-3" /> {status.negativeHours.length} h en negativo hoy
            </Badge>
          )}
          {status.zeroOrNegativeHours.length > status.negativeHours.length && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 tabular-nums">
              {status.zeroOrNegativeHours.length} h a ≤ 0 €/MWh
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{status.detail}</p>
    </div>
  );
}

function TodayPriceSection({ today, currentHour }: { today: ElectricityToday; currentHour: number }) {
  const why = explainExtremes(today);
  const washer = washerExample(today);
  const tomorrowBest = today.tomorrowMarket.reduce<(typeof today.tomorrowMarket)[number] | null>(
    (best, h) => (best === null || h.market < best.market ? h : best),
    null,
  );

  return (
    <>
      <PriceChart today={today} currentHour={currentHour} />

      {today.cheapest.length > 0 && (
        <Card size="sm" className="bg-card/80">
          <CardContent className="grid gap-2.5 text-sm">
            <p className="font-medium">Mejores franjas hoy para la lavadora o cargar el coche</p>
            <ul className="grid gap-1.5 sm:grid-cols-3">
              {today.cheapest.map((c) => (
                <li
                  key={c.hours}
                  className="flex flex-col gap-0.5 rounded-xl border bg-background/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {c.hours} h desde las {formatHour(c.start)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{formatEurPerKwh(c.average)}</span>
                  <span className="font-medium text-emerald-400 tabular-nums">−{c.savingPercent} % vs media</span>
                </li>
              ))}
            </ul>
            {washer && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <WashingMachineIcon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                Un ciclo de lavadora (≈{WASHER_KWH} kWh) cuesta {washer.cheap} en la hora más barata frente a{" "}
                {washer.expensive} en la más cara ({washer.saving} de ahorro cada vez).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(why.length > 0 || tomorrowBest) && (
        <details className="rounded-xl border bg-card/60 p-3.5 text-sm">
          <summary className="cursor-pointer font-medium">¿Por qué cambia tanto el precio hoy y cómo se forma?</summary>
          <div className="mt-3 grid gap-2.5 text-xs leading-relaxed text-muted-foreground">
            {why.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              <span className="font-medium text-foreground">Energía (mercado marginalista):</span> las centrales ofertan
              de la más barata (sol, viento, nuclear) a la más cara (gas) y todas cobran la última necesaria. Cuando hay
              excedente renovable, el gas no entra y el mercado cae a 0 € o negativo.
            </p>
            <ul className="grid gap-1 sm:grid-cols-3">
              {(Object.keys(PERIODS) as TariffPeriod[]).map((p) => (
                <li key={p} className="rounded-lg border bg-background/50 p-2">
                  <span className="font-medium text-foreground">{PERIODS[p].label}: </span>
                  {PERIODS[p].hours}
                </li>
              ))}
            </ul>
            {tomorrowBest && (
              <p>
                <span className="font-medium text-foreground">Mañana:</span> el mercado diario ya cerró y su mínimo será
                a las {formatHour(tomorrowBest.start)} ({formatEurPerKwh(Math.max(tomorrowBest.market, 0))}, sin
                peajes).
              </p>
            )}
          </div>
        </details>
      )}
    </>
  );
}

function NowMixSection({ now }: { now: ElectricityNow }) {
  const maxShare = Math.max(...now.mix.map((m) => m.share));
  const flows = flowsSentence(now);

  return (
    <details className="rounded-xl border bg-card/60 p-3.5">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-muted-foreground" />
          Desglose de generación en directo ({now.mix.length} tecnologías)
        </span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {formatGw(now.generationMw)} totales
        </span>
      </summary>

      <div className="mt-3 grid gap-2">
        <ul className="grid gap-1" aria-label="Generación por tecnología">
          {now.mix.map((m) => {
            const tech = TECHS[m.id];
            return (
              <li key={m.id}>
                <details className="group rounded-lg open:bg-muted/60">
                  <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg p-2 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="truncate">{tech.label}</span>
                      {m.renewable && (
                        <Badge variant="outline" className="h-4 border-emerald-500/30 px-1 text-[10px] text-emerald-400">
                          renovable
                        </Badge>
                      )}
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      {formatPercent(m.share)}{" "}
                      <span className="text-xs text-muted-foreground">· {formatGw(m.mw)}</span>
                    </span>
                    <span className="col-span-2 h-1.5 rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${m.renewable ? RENEWABLE_BAR : OTHER_BAR}`}
                        style={{ width: `${(m.share / maxShare) * 100}%` }}
                      />
                    </span>
                  </summary>
                  <div className="grid gap-1 px-2 pb-2 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">De dónde sale: </span>
                      {tech.origin}
                    </p>
                    <p>
                      <span className="text-foreground">Y el precio: </span>
                      {tech.price}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Pulsa una tecnología para ver de dónde sale y cómo afecta al precio.
          {flows && ` ${flows}`}
        </p>
      </div>
    </details>
  );
}

/** Índice de la hora de `hours` que contiene el instante `at`. */
function hourIndex(today: ElectricityToday, atMs: number) {
  const i = today.hours.findIndex((h) => {
    const start = Date.parse(h.start);
    return atMs >= start && atMs < start + 3_600_000;
  });
  return Math.max(i, 0);
}

function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}

function ZoneMetric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald";
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-heading text-base font-semibold tabular-nums",
          accent === "emerald" ? "text-emerald-400" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground tabular-nums">{sub}</span>}
    </div>
  );
}

function Stat({
  icon,
  label,
  sub,
  accent,
  children,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  accent?: "emerald";
  children: ReactNode;
}) {
  return (
    <Card size="sm" className="bg-card/80">
      <CardContent className="grid gap-1">
        <span className="flex items-center gap-1 text-xs text-muted-foreground [&_svg]:size-3.5">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "font-heading text-base font-semibold tabular-nums",
            accent === "emerald" ? "text-emerald-400" : "text-foreground",
          )}
        >
          {children}
        </span>
        {sub && <span className="text-[11px] text-muted-foreground tabular-nums">{sub}</span>}
      </CardContent>
    </Card>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{children}</p>
  );
}
