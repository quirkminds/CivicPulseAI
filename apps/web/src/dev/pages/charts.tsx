import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { GenerationChart } from "@/features/casa/generation-chart";
import { PriceChart } from "@/features/casa/price-chart";
import { StationsChart } from "@/features/trayecto/stations-chart";
import { formatHour, formatPercent } from "@/lib/format";
import { Specimen, Surface } from "../components/specimen";
import { sampleElectricityNow, sampleElectricityToday, sampleTrip } from "../fixtures";

const renewableConfig = {
  renewable: {
    label: "Renovable total",
    color: "var(--chart-1)",
  },
  wind: {
    label: "Eólica",
    color: "var(--chart-2)",
  },
  solar: {
    label: "Solar",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const renewableData = sampleElectricityToday.hours
  .filter((h) => h.renewableShare !== null)
  .map((h) => ({
    hour: `${formatHour(h.start).slice(0, 2)}h`,
    renewable: h.renewableShare ?? 0,
    wind: h.windShare ?? 0,
    solar: h.solarShare ?? 0,
  }));

export function ChartsPage() {
  return (
    <>
      <Specimen
        title="Curva de demanda y generación por tecnología (MW)"
        description="ComposedChart de shadcn/charts inspirado en Red Eléctrica: áreas apiladas por fuente, saldos exportadores/bombeo bajo cero y línea blanca de demanda real."
      >
        <Surface className="block">
          <GenerationChart today={sampleElectricityToday} now={sampleElectricityNow} />
        </Surface>
      </Specimen>

      <Specimen
        title="Precio de la luz hoy (PVPC 24 h)"
        description="BarChart apilado de shadcn/charts usado en «Mi casa»: mercado diario + peajes y cargos con línea de media."
      >
        <Surface className="block">
          <PriceChart today={sampleElectricityToday} currentHour={15} />
        </Surface>
      </Specimen>

      <Specimen
        title="Gasolineras más baratas en ruta"
        description="BarChart horizontal compacto que se despliega en «Mi trayecto» al pulsar la píldora de gasolineras."
      >
        <Surface className="block">
          <div className="max-w-md rounded-xl border bg-card/80 p-3">
            <StationsChart stations={sampleTrip.stations} />
          </div>
        </Surface>
      </Specimen>

      <Specimen
        title="Generación renovable por hora"
        description="AreaChart con los tokens arcoíris (--chart-1 verde, --chart-2 azul, --chart-3 ámbar) sobre superficie oscura."
      >
        <Surface className="block">
          <ChartContainer config={renewableConfig} className="h-60 w-full">
            <AreaChart data={renewableData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                width={44}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {renewableConfig[name as keyof typeof renewableConfig]?.label ?? String(name)}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {typeof value === "number" ? formatPercent(value) : String(value)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="renewable"
                stroke="var(--color-renewable)"
                fill="var(--color-renewable)"
                fillOpacity={0.14}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="wind"
                stroke="var(--color-wind)"
                fill="var(--color-wind)"
                fillOpacity={0.12}
                strokeWidth={1.75}
              />
              <Area
                type="monotone"
                dataKey="solar"
                stroke="var(--color-solar)"
                fill="var(--color-solar)"
                fillOpacity={0.12}
                strokeWidth={1.75}
              />
            </AreaChart>
          </ChartContainer>
        </Surface>
      </Specimen>
    </>
  );
}
