import { Specimen, Surface } from "../components/specimen";

type Token = {
  name: string;
  /** Clases literales (Tailwind solo genera las que ve escritas enteras). */
  swatch: string;
  role: string;
};

const surfaceTokens: Token[] = [
  { name: "background", swatch: "bg-background text-foreground", role: "Fondo de la página." },
  { name: "card", swatch: "bg-card text-card-foreground", role: "Tarjetas y estadísticas." },
  { name: "popover", swatch: "bg-popover text-popover-foreground", role: "Popups del mapa y tooltips." },
  { name: "muted", swatch: "bg-muted text-muted-foreground", role: "Hover, selección y texto secundario." },
];

const actionTokens: Token[] = [
  { name: "primary", swatch: "bg-primary text-primary-foreground", role: "Acción principal y badges por defecto." },
  { name: "secondary", swatch: "bg-secondary text-secondary-foreground", role: "Acción secundaria, badge «Datos de ejemplo»." },
  { name: "accent", swatch: "bg-accent text-accent-foreground", role: "Resaltes suaves en menús." },
  { name: "destructive", swatch: "bg-destructive text-white", role: "Errores y acciones peligrosas." },
];

const lineTokens: Token[] = [
  { name: "border", swatch: "bg-border", role: "Bordes y separadores." },
  { name: "input", swatch: "bg-input", role: "Borde de los campos." },
  { name: "ring", swatch: "bg-ring", role: "Anillo de foco." },
];

const chartTokens: Token[] = [
  { name: "chart-1", swatch: "bg-chart-1", role: "" },
  { name: "chart-2", swatch: "bg-chart-2", role: "" },
  { name: "chart-3", swatch: "bg-chart-3", role: "" },
  { name: "chart-4", swatch: "bg-chart-4", role: "" },
  { name: "chart-5", swatch: "bg-chart-5", role: "" },
];

/** Colores escritos a mano en features/trayecto/trayecto-map.tsx, fuera de los tokens. */
const looseColors = [
  { name: "Ruta en coche", value: "#2563eb", swatch: "bg-[#2563eb]" },
  { name: "Franja de 300 m", value: "#3b82f6 · 8 %", swatch: "bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/30 ring-inset" },
  { name: "Pin de destino", value: "emerald-600", swatch: "bg-emerald-600" },
  { name: "Pin de cámara", value: "amber-400", swatch: "bg-amber-400" },
  { name: "Cámara elegida", value: "amber-500", swatch: "bg-amber-500" },
];

function TokenGrid({ tokens }: { tokens: Token[] }) {
  return (
    <ul className="grid w-full gap-3 sm:grid-cols-2">
      {tokens.map((token) => (
        <li key={token.name} className="flex flex-col overflow-hidden rounded-xl border">
          <div className={`flex h-16 items-end p-3 font-heading text-sm font-semibold ${token.swatch}`}>
            {token.name}
          </div>
          {token.role && <p className="p-3 text-xs text-muted-foreground">{token.role}</p>}
        </li>
      ))}
    </ul>
  );
}

export function ColorsPage() {
  return (
    <>
      <p className="max-w-2xl rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Hoy la paleta es la neutra de shadcn (preset Nova, base <code>neutral</code>): todavía no hay color de marca.
        Los tokens viven en <code>src/index.css</code>; cambiar uno aquí cambia toda la app.
      </p>

      {[
        { title: "Superficies", description: "Dónde se apoya el contenido.", tokens: surfaceTokens },
        { title: "Acciones", description: "Botones, badges y estados.", tokens: actionTokens },
        { title: "Líneas y foco", description: "Bordes, campos y anillo de foco.", tokens: lineTokens },
        { title: "Gráficas", description: "Escala para datos; aún sin usar.", tokens: chartTokens },
      ].map((group) => (
        <Specimen key={group.title} title={group.title} description={group.description}>
          <Surface tone="light">
            <TokenGrid tokens={group.tokens} />
          </Surface>
          <Surface tone="dark">
            <TokenGrid tokens={group.tokens} />
          </Surface>
        </Specimen>
      ))}

      <Specimen
        title="Colores fuera del sistema"
        description="Escritos a mano en el mapa. Son los primeros candidatos a convertirse en tokens de marca."
        wide
      >
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {looseColors.map((color) => (
            <li key={color.name} className="flex flex-col overflow-hidden rounded-xl border">
              <div className={`h-16 ${color.swatch}`} />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="text-sm font-medium">{color.name}</span>
                <code className="text-xs text-muted-foreground">{color.value}</code>
              </div>
            </li>
          ))}
        </ul>
      </Specimen>
    </>
  );
}
