import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatPricePerLiter } from "@/lib/format";
import type { Station } from "@/lib/types";

const chartConfig = {
  price: {
    label: "Precio",
    color: "var(--chart-2)",
  },
  cheapest: {
    label: "Más barata",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function shortBrand(brand: string): string {
  const clean = brand.trim();
  return clean.length > 11 ? `${clean.slice(0, 10)}…` : clean;
}

/** Comparativa de precios €/l de las gasolineras más baratas cerca de la ruta, con shadcn/charts. */
export function StationsChart({ stations }: { stations: Station[] }) {
  const top = stations.slice(0, 5);
  if (top.length < 2) return null;

  const prices = top.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const domainMin = Math.max(0, Math.floor((min - 0.05) * 20) / 20);
  const domainMax = Math.ceil((max + 0.02) * 20) / 20;

  const data = top.map((st, index) => ({
    id: st.id,
    name: shortBrand(st.brand),
    fullLabel: `${st.brand} · ${st.address}`,
    price: st.price,
    cheapest: index === 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-36 w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[domainMin, domainMax]}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tickFormatter={(v: number) => `${v.toFixed(2)} €`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={76}
          tickMargin={4}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.35 }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) => {
                const row = payload[0]?.payload as { fullLabel?: string } | undefined;
                return row?.fullLabel ?? "";
              }}
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums">
                  {typeof value === "number" ? formatPricePerLiter(value) : String(value)}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="price" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell key={entry.id} fill={entry.cheapest ? "var(--chart-1)" : "var(--chart-2)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
