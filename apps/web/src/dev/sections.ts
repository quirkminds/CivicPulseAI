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
    description: "Tokens de shadcn por rol, sobre superficie clara y oscura, y los colores sueltos del mapa.",
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
    description: "Badge, Card, la tarjeta de estadística y la lista de cámaras.",
  },
  {
    slug: "estados",
    title: "Estados",
    description: "Carga, vacío, error y «próximamente».",
  },
  {
    slug: "mapa",
    title: "Mapa",
    description: "Pines, ruta y franja de 300 m sobre mapcn, con datos de ejemplo.",
  },
];
