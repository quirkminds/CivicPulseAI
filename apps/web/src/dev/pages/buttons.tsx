import { ArrowRightIcon, CarIcon, LocateFixedIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Specimen, Surface } from "../components/specimen";

const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const sizes = ["xs", "sm", "default", "lg"] as const;
const iconSizes = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

export function ButtonsPage() {
  return (
    <>
      <Specimen title="Variantes" description="De más a menos peso. Una sola acción principal por pantalla.">
        <Surface>
          {variants.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </Surface>
      </Specimen>

      <Specimen title="Tamaños" description="default (h-8) en la app; lg para la llamada a la acción.">
        <Surface>
          {sizes.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </Surface>
      </Specimen>

      <Specimen title="Con icono" description="Iconos de lucide con data-icon para ajustar el padding.">
        <Surface>
          <Button>
            <CarIcon data-icon="inline-start" /> Ir en coche
          </Button>
          <Button variant="outline">
            Ver ruta <ArrowRightIcon data-icon="inline-end" />
          </Button>
          {iconSizes.map((size) => (
            <Button key={size} size={size} variant="outline" aria-label={`Mi ubicación (${size})`}>
              <LocateFixedIcon />
            </Button>
          ))}
        </Surface>
      </Specimen>

      <Specimen title="Estados" description="Deshabilitado e inválido. El foco se ve con Tab.">
        <Surface>
          <Button disabled>Deshabilitado</Button>
          <Button variant="outline" disabled>
            Deshabilitado
          </Button>
          <Button variant="outline" aria-invalid>
            Inválido
          </Button>
          <Button variant="destructive">
            <TrashIcon data-icon="inline-start" /> Borrar
          </Button>
        </Surface>
      </Specimen>
    </>
  );
}
