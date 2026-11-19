import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SpecimenProps = {
  title: string;
  description?: string;
  /** Una columna para piezas anchas (mapa, tablas); dos en pantallas grandes por defecto. */
  wide?: boolean;
  children: ReactNode;
};

/** Bloque de la galería: título, para qué sirve y los ejemplos. */
export function Specimen({ title, description, wide = false, children }: SpecimenProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid gap-4", !wide && "xl:grid-cols-2")}>{children}</div>
    </section>
  );
}

type SurfaceProps = {
  tone: "light" | "dark";
  className?: string;
  children: ReactNode;
};

/**
 * Muestra lo que contiene sobre fondo claro u oscuro. `.dark` redefine las variables de shadcn,
 * así que los componentes se ven igual que con el tema oscuro (salvo los que abren un portal).
 */
export function Surface({ tone, className, children }: SurfaceProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-background p-6 text-foreground",
        tone === "dark" && "dark",
      )}
    >
      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {tone === "light" ? "Claro" : "Oscuro"}
      </span>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

/** El mismo contenido en claro y en oscuro, uno al lado del otro. */
export function BothSurfaces({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <>
      <Surface tone="light" className={className}>
        {children}
      </Surface>
      <Surface tone="dark" className={className}>
        {children}
      </Surface>
    </>
  );
}
