import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { hourGenerationMix } from "@/lib/energy";
import { formatGw, formatHour, formatPercent } from "@/lib/format";
import type { ElectricityNow, ElectricityToday } from "@/lib/types";

// Paleta arcoíris calibrada para superficie oscura, inspirada en el gráfico de generación en tiempo real de REE.
const chartConfig = {
  hydro: { label: "Hidráulica", color: "#38bdf8" },
  nuclear: { label: "Nuclear", color: "#a78bfa" },
  gas: { label: "Ciclo comb. y gas", color: "#f87171" },
  other: { label: "Resto", color: "#94a3b8" },
  wind: { label: "Eólica", color: "#34d399" },
  solar: { label: "Solar", color: "#facc15" },
  exportsNeg: { label: "Exportaciones", color: "#2dd4bf" },
  pumpingNeg: { label: "Bombeo", color: "#818cf8" },
  demandMw: { label: "Demanda real", color: "#ffffff" },
} satisfies ChartConfig;

const POSITIVE_KEYS = ["hydro", "nuclear", "gas", "other", "wind", "solar"] as const;

type ChartRow = {
  hour: string;
  shortHour: string;
  demandMw: number | null;
  hydro: number | null;
  nuclear: number | null;
  gas: number | null;
  other: number | null;
  wind: number | null;
  solar: number | null;
  exportsNeg: number | null;
  pumpingNeg: number | null;
  renewableShare: number | null;
};

/**
 * Curva de demanda y estructura de generación acumulada por tecnologías (MW) con shadcn/charts,
 * inspirada en el gráfico en tiempo real de Red Eléctrica (áreas apiladas + saldo exportador/bombeo bajo cero + línea de demanda).
 */
export function GenerationChart({ today, now }: { today: ElectricityToday; now?: ElectricityNow }) {
  const rows: ChartRow[] = today.hours.map((h) => {
    const mix = hourGenerationMix(h);
    const label = formatHour(h.start);
    return {
      hour: label,
      shortHour: `${label.slice(0, 2)}h`,
      demandMw: h.demandMw,
      hydro: mix ? mix.hydro : null,
      nuclear: mix ? mix.nuclear : null,
      gas: mix ? mix.gas : null,
      other: mix ? mix.other : null,
      wind: mix ? mix.wind : null,
      solar: mix ? mix.solar : null,
      exportsNeg: mix && mix.exports > 0 ? -mix.exports : mix ? 0 : null,
      pumpingNeg: mix && mix.pumping > 0 ? -mix.pumping : mix ? 0 : null,
      renewableShare: h.renewableShare,
    };
  });

  const hasGeneration = rows.some((r) => r.demandMw !== null);
  const hasNegativeFlow = rows.some((r) => (r.exportsNeg ?? 0) < 0 || (r.pumpingNeg ?? 0) < 0);
  const surplusMw = now ? now.generationMw - now.demandMw : null;

  if (!hasGeneration) {
    return (
      <div className="rounded-xl border bg-card/80 p-4 text-sm text-muted-foreground">
        Sin datos horarios de generación todavía (se muestran cuando ESIOS está activo).
      </div>
    );
  }

  return (
    <figure className="grid gap-3 rounded-xl border bg-card/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Estructura de generación y demanda</span>
          <span>· península hoy (GW)</span>
        </div>
        {now && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="tabular-nums">
              Producción {formatGw(now.generationMw)}
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              Demanda {formatGw(now.demandMw)}
            </Badge>
            {surplusMw !== null && surplusMw > 0 && (
              <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-400 tabular-nums">
                Excedente +{formatGw(surplusMw)}
              </Badge>
            )}
          </div>
        )}
      </div>

      <ChartContainer config={chartConfig} className="h-72 w-full">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} stackOffset="sign">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="shortHour" tickLine={false} axisLine={false} tickMargin={8} interval={2} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={52}
            tickFormatter={(v: number) => `${Math.round(v / 1000)} GW`}
          />
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />

          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = payload[0]?.payload as ChartRow | undefined;
                  if (!row) return "";
                  const renew = row.renewableShare !== null ? ` · ${formatPercent(row.renewableShare)} renovable` : "";
                  return `${row.hour}${renew}`;
                }}
                formatter={(value, name) => {
                  const num = typeof value === "number" ? Math.abs(value) : null;
                  if (num === 0) return null;
                  const key = name as keyof typeof chartConfig;
                  return (
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <span className="text-muted-foreground">{chartConfig[key]?.label ?? String(name)}</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {num !== null ? formatGw(num) : String(value)}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />

          <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-3 gap-y-1 text-[11px]" />} />

          {POSITIVE_KEYS.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="gen"
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.78}
              strokeWidth={1.25}
              isAnimationActive={false}
            />
          ))}

          {hasNegativeFlow && (
            <>
              <Area
                type="monotone"
                dataKey="exportsNeg"
                stackId="gen"
                stroke="var(--color-exportsNeg)"
                fill="var(--color-exportsNeg)"
                fillOpacity={0.45}
                strokeWidth={1}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="pumpingNeg"
                stackId="gen"
                stroke="var(--color-pumpingNeg)"
                fill="var(--color-pumpingNeg)"
                fillOpacity={0.45}
                strokeWidth={1}
                isAnimationActive={false}
              />
            </>
          )}

          <Line
            type="monotone"
            dataKey="demandMw"
            stroke="var(--color-demandMw)"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, fill: "#ffffff", stroke: "#000000", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>

      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          La línea blanca marca la demanda real. Por debajo de 0 GW se dibuja la energía sobrante (exportación y bombeo).
        </span>
        <span>Las horas futuras aparecen vacías hasta publicarse.</span>
      </figcaption>
    </figure>
  );
}
