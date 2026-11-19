import type { ComponentType } from "react";
import { BarrioPage } from "./pages/barrio";
import { ButtonsPage } from "./pages/buttons";
import { ChartsPage } from "./pages/charts";
import { ColorsPage } from "./pages/colors";
import { ControlsPage } from "./pages/controls";
import { DataPage } from "./pages/data";
import { MapPage } from "./pages/map";
import { OverviewPage } from "./pages/overview";
import { StatesPage } from "./pages/states";
import { TypographyPage } from "./pages/typography";
import { devSections } from "./sections";

const pages: Record<string, ComponentType> = {
  colores: ColorsPage,
  tipografia: TypographyPage,
  botones: ButtonsPage,
  controles: ControlsPage,
  datos: DataPage,
  graficas: ChartsPage,
  estados: StatesPage,
  mapa: MapPage,
  barrio: BarrioPage,
};

/**
 * Galería del design system en /dev. Solo existe con `vite dev`: main.tsx la importa tras
 * comprobar `import.meta.env.DEV`, así que no entra en el build.
 * Cada sección es una URL propia (/dev/<slug>) con enlaces normales, sin router.
 */
export default function DevGallery() {
  const slug = window.location.pathname.replace(/^\/dev\/?/, "").replace(/\/$/, "");
  const section = devSections.find((s) => s.slug === slug);
  const Page = section ? pages[section.slug] : undefined;

  return (
    <div className="mx-auto grid min-h-dvh max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[12rem_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-10 lg:self-start">
        <a href="/dev" className="font-heading text-xl font-bold tracking-tight">
          CivicPulse
          <span className="block font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Design system
          </span>
        </a>
        <nav className="flex flex-col gap-1 text-sm">
          {devSections.map((s) => (
            <a
              key={s.slug}
              href={`/dev/${s.slug}`}
              aria-current={s.slug === slug ? "page" : undefined}
              className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {s.title}
            </a>
          ))}
        </nav>
        <a href="/" className="px-3 text-sm text-muted-foreground hover:text-foreground">
          ← Volver a la app
        </a>
      </aside>

      <main className="flex min-w-0 flex-col gap-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl">{section?.title ?? "Resumen"}</h1>
          <p className="max-w-2xl text-muted-foreground">
            {section?.description ??
              "Todas las piezas de la interfaz en modo oscuro para dar forma a la marca. Solo en desarrollo."}
          </p>
        </header>
        {Page ? <Page /> : <OverviewPage />}
      </main>
    </div>
  );
}
