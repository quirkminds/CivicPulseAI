export type DevSection = {
  slug: string;
  title: string;
  description: string;
};

/** Secciones de la galería. Cada slug es /dev/<slug> y tiene su página en src/dev/pages/. */
export const devSections: DevSection[] = [
  {
    slug: "colores",
    title: "Colores",
    description: "Blanco y negro estilo Vercel para la estructura y escala arcoíris semántica para señales y gráficas.",
  },
  {
    slug: "tipografia",
    title: "Tipografía",
    description: "Inter para títulos, Figtree para texto, escala y cifras tabulares.",
  },
  {
    slug: "botones",
    title: "Botones",
    description: "Variantes, tamaños, iconos y estados de Button.",
  },
  {
    slug: "controles",
    title: "Controles",
    description: "Input, Label, ToggleGroup, Tabs y Tooltip tal y como los usa «Mi trayecto».",
  },
  {
    slug: "datos",
    title: "Datos",
    description: "Badge, Card, el panel con divulgación progresiva y píldoras de alertas.",
  },
  {
    slug: "graficas",
    title: "Gráficas",
    description: "Visualizaciones con shadcn/charts (Recharts) alineadas con el design system de mapcn.",
  },
  {
    slug: "estados",
    title: "Estados",
    description: "Carga, vacío, error y «próximamente».",
  },
  {
    slug: "mapa",
    title: "Mapa",
    description: "Pines, ruta, capas bajo demanda y franja de 300 m sobre mapcn, con datos de ejemplo.",
  },
  {
    slug: "barrio",
    title: "Mi barrio",
    description: "Mapa y ficha de renta y demografía del INE.",
  },
];
