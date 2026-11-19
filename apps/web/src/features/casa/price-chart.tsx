import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PERIODS } from "@/lib/energy";
import { formatEurPerKwh, formatHour, formatPercent } from "@/lib/format";
import type { ElectricityToday } from "@/lib/types";

const chartConfig = {
  market: {
    label: "Energía (mercado)",
    color: "var(--chart-2)",
  },
  regulated: {
    label: "Peajes y cargos",
    color: "var(--chart-3)",
  },
  price: {
    label: "PVPC",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/**
 * PVPC de hoy por horas con shadcn/charts (Recharts): cada barra apila la energía del mercado
 * y los peajes y cargos, con línea de media diaria y tabla accesible desplegable.
 */
export function PriceChart({ today, currentHour }: { today: ElectricityToday; currentHour: number }) {
  const { hours } = today;
  const split = hours.some((h) => h.market !== null);
  const best = today.cheapest.find((c) => c.hours === 2);
  const currentSlot = hours[currentHour];
  const currentLabel = currentSlot ? formatHour(currentSlot.start) : undefined;

  const data = hours.map((h) => {
    const market = split ? Math.max(h.market ?? 0, 0) : 0;
    const regulated = split ? Math.max(h.price - market, 0) : 0;
    return {
      hour: formatHour(h.start),
      shortHour: `${formatHour(h.start).slice(0, 2)}h`,
      price: h.price,
      market,
      regulated,
      period: h.period,
      renewableShare: h.renewableShare,
      solarShare: h.solarShare,
      windShare: h.windShare,
    };
  });

  return (
    <figure className="grid gap-3 rounded-xl border bg-card/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Media hoy:{" "}
            <span className="font-medium text-foreground tabular-nums">{formatEurPerKwh(today.average)}</span>
          </span>
          {currentSlot && (
            <Badge variant="outline" className="tabular-nums">
              Ahora ({currentLabel}): {formatEurPerKwh(currentSlot.price)}
            </Badge>
          )}
        </div>
        {best && (
          <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-400 tabular-nums">
            Mejor 2 h: {formatHour(best.start)} · {formatEurPerKwh(best.average)}
          </Badge>
        )}
      </div>

      <ChartContainer config={chartConfig} className="h-56 w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="shortHour"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={2}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={52}
            tickFormatter={(v: number) => `${v.toFixed(2)} €`}
          />
          <ReferenceLine
            y={today.average}
            stroke="var(--chart-1)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = payload[0]?.payload as (typeof data)[number] | undefined;
                  if (!row) return "";
                  const period = row.period ? ` · ${PERIODS[row.period].label}` : "";
                  const renew = row.renewableShare !== null ? ` · ${formatPercent(row.renewableShare)} renov.` : "";
                  return `${row.hour}${period}${renew}`;
                }}
                formatter={(value, name) => (
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {typeof value === "number" ? formatEurPerKwh(value) : String(value)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {split ? (
            <>
              <Bar dataKey="market" stackId="pvpc" fill="var(--color-market)" radius={[0, 0, 2, 2]} />
              <Bar dataKey="regulated" stackId="pvpc" fill="var(--color-regulated)" radius={[4, 4, 0, 0]} />
            </>
          ) : (
            <Bar dataKey="price" fill="var(--color-price)" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ChartContainer>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver tabla de 24 horas</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Hora</th>
              <th className="py-1 font-normal">€/kWh</th>
              <th className="py-1 font-normal">Energía</th>
              <th className="py-1 font-normal">Periodo</th>
              <th className="py-1 font-normal">Renov.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {hours.map((h) => (
              <tr key={h.start}>
                <td className="py-1">{formatHour(h.start)}</td>
                <td className="py-1">{h.price.toLocaleString("es-ES", { minimumFractionDigits: 3 })}</td>
                <td className="py-1">
                  {h.market === null ? "—" : Math.max(h.market, 0).toLocaleString("es-ES", { minimumFractionDigits: 3 })}
                </td>
                <td className="py-1">{h.period ?? "—"}</td>
                <td className="py-1">{h.renewableShare === null ? "—" : formatPercent(h.renewableShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
