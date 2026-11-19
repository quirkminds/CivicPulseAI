import { Specimen, Surface } from "../components/specimen";

type Token = {
  name: string;
  /** Clases literales (Tailwind solo genera las que ve escritas enteras). */
  swatch: string;
  role: string;
};

const surfaceTokens: Token[] = [
  { name: "background", swatch: "bg-background text-foreground", role: "Lienzo principal (negro profundo estilo Vercel)." },
  { name: "card", swatch: "bg-card text-card-foreground", role: "Tarjetas flotantes y métricas." },
  { name: "popover", swatch: "bg-popover text-popover-foreground", role: "Popups del mapa y tooltips de gráficas." },
  { name: "muted", swatch: "bg-muted text-muted-foreground", role: "Hover, fondos suaves y texto secundario." },
];

const actionTokens: Token[] = [
  { name: "primary", swatch: "bg-primary text-primary-foreground", role: "Blanco puro: acción principal y pestaña activa." },
  { name: "secondary", swatch: "bg-secondary text-secondary-foreground", role: "Acción secundaria y badges discretos." },
  { name: "accent", swatch: "bg-accent text-accent-foreground", role: "Resaltes suaves en menús y listas." },
  { name: "destructive", swatch: "bg-destructive text-white", role: "Alertas críticas e incidencias DGT." },
];

const lineTokens: Token[] = [
  { name: "border", swatch: "bg-border", role: "Bordes hairline de 1 px (blanco al 10 %)." },
  { name: "input", swatch: "bg-input", role: "Borde de los campos de texto." },
  { name: "ring", swatch: "bg-ring", role: "Anillo de foco accesible." },
];

const chartTokens: Token[] = [
  { name: "chart-1", swatch: "bg-chart-1 text-zinc-950", role: "Verde · ahorro, hora valle, renovable, gasolinera más barata." },
  { name: "chart-2", swatch: "bg-chart-2 text-zinc-950", role: "Azul · ruta en coche, energía de mercado, movilidad." },
  { name: "chart-3", swatch: "bg-chart-3 text-zinc-950", role: "Ámbar · cámaras, peajes/llano, precaución." },
  { name: "chart-4", swatch: "bg-chart-4 text-zinc-950", role: "Violeta · transporte público y generación no renovable." },
  { name: "chart-5", swatch: "bg-chart-5 text-white", role: "Rojo · incidencias DGT y hora punta." },
];

function TokenGrid({ tokens, cols = 4 }: { tokens: Token[]; cols?: 4 | 5 }) {
  return (
    <ul className={`grid w-full gap-3 sm:grid-cols-2 ${cols === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
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
        Estructura monocroma en blanco y negro estilo Vercel definida en <code>:root</code> (<code>src/index.css</code>).
        El color solo aparece como señal semántica en el mapa, las alertas y las gráficas (<code>--chart-1..5</code>).
      </p>

      {[
        { title: "Superficies", description: "Dónde se apoya el contenido.", tokens: surfaceTokens, cols: 4 as const },
        { title: "Acciones", description: "Botones, pestaña activa y estados.", tokens: actionTokens, cols: 4 as const },
        { title: "Líneas y foco", description: "Bordes hairline, campos y foco.", tokens: lineTokens, cols: 4 as const },
        {
          title: "Arcoíris semántico (gráficas y alertas)",
          description: "Tokens compartidos entre shadcn/charts, píldoras de alerta y pines del mapa.",
          tokens: chartTokens,
          cols: 5 as const,
        },
      ].map((group) => (
        <Specimen key={group.title} title={group.title} description={group.description}>
          <Surface>
            <TokenGrid tokens={group.tokens} cols={group.cols} />
          </Surface>
        </Specimen>
      ))}
    </>
  );
}
