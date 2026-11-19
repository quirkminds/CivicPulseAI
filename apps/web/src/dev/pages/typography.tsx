import { Specimen } from "../components/specimen";

const headings = [
  { tag: "h1", className: "text-4xl", sample: "Vive más barato" },
  { tag: "h2", className: "text-xl", sample: "Cámaras en tu ruta" },
  { tag: "h3", className: "text-lg", sample: "Campus Sur" },
  { tag: "h4", className: "text-sm font-semibold", sample: "Desde" },
] as const;

const body = [
  { label: "text-base", className: "text-base", sample: "Cruzamos datos abiertos oficiales para que te cueste menos moverte." },
  { label: "text-sm", className: "text-sm", sample: "Ruta y tiempo de CartoCiudad, ajustado con el tráfico en vivo." },
  {
    label: "text-sm · muted",
    className: "text-sm text-muted-foreground",
    sample: "a menos de 300 m de la ruta",
  },
  { label: "text-xs · muted", className: "text-xs text-muted-foreground", sample: "En el km 4,2 de tu ruta · a 35 m" },
];

export function TypographyPage() {
  return (
    <>
      <Specimen title="Familias" description="Se cargan desde el proyecto con @fontsource-variable.">
        <div className="flex flex-col gap-2 rounded-2xl border p-6">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            font-heading · Inter
          </span>
          <p className="font-heading text-5xl font-semibold tracking-tight">Aa 0123</p>
          <p className="font-heading text-sm text-muted-foreground">Títulos h1–h6, cifras de las estadísticas.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border p-6">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            font-sans · Figtree
          </span>
          <p className="font-sans text-5xl font-semibold">Aa 0123</p>
          <p className="text-sm text-muted-foreground">Texto, etiquetas, botones y listas.</p>
        </div>
      </Specimen>

      <Specimen title="Títulos" description="h1–h6 llevan font-heading y tracking-tight desde index.css." wide>
        <div className="flex flex-col divide-y rounded-2xl border">
          {headings.map(({ tag, className, sample }) => {
            const Tag = tag;
            return (
              <div key={tag} className="flex items-baseline gap-6 p-4">
                <code className="w-28 shrink-0 text-xs text-muted-foreground">
                  {tag} · {className}
                </code>
                <Tag className={className}>{sample}</Tag>
              </div>
            );
          })}
        </div>
      </Specimen>

      <Specimen title="Texto" wide>
        <div className="flex flex-col divide-y rounded-2xl border">
          {body.map(({ label, className, sample }) => (
            <div key={label} className="flex items-baseline gap-6 p-4">
              <code className="w-28 shrink-0 text-xs text-muted-foreground">{label}</code>
              <p className={className}>{sample}</p>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        title="Cifras"
        description="Euros, minutos y kilómetros con tabular-nums, para que no bailen al cambiar."
      >
        <div className="flex flex-col gap-1 rounded-2xl border p-6">
          <span className="text-xs text-muted-foreground">Proporcionales</span>
          <span className="font-heading text-3xl font-semibold">11,1 € · 47 min</span>
          <span className="font-heading text-3xl font-semibold">88,8 € · 14 min</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border p-6">
          <span className="text-xs text-muted-foreground">tabular-nums</span>
          <span className="font-heading text-3xl font-semibold tabular-nums">11,1 € · 47 min</span>
          <span className="font-heading text-3xl font-semibold tabular-nums">88,8 € · 14 min</span>
        </div>
      </Specimen>
    </>
  );
}
