import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SpecimenProps = {
  title: string;
  description?: string;
  /** Dos columnas en pantallas grandes para comparar pares (p. ej. fuentes o cifras). */
  columns?: 1 | 2;
  children: ReactNode;
};

/** Bloque de la galería: título, para qué sirve y los ejemplos. */
export function Specimen({ title, description, columns = 1, children }: SpecimenProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">{title}</h2>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid gap-4", columns === 2 && "xl:grid-cols-2")}>{children}</div>
    </section>
  );
}

type SurfaceProps = {
  className?: string;
  children: ReactNode;
};

/** Lienzo unificado en modo oscuro donde se muestran los componentes del design system. */
export function Surface({ className, children }: SurfaceProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background p-6 text-foreground">
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}
