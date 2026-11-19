import { LoaderCircleIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type LocatedPlace, locatePlace, type Place } from "@/lib/geocoder";
import { cn } from "@/lib/utils";
import { usePlaceSearch } from "./use-place-search";

/** Atajo fijo arriba de los resultados: «Mi ubicación», un campus… */
export type PlaceShortcut = { id: string; label: string; detail?: string; icon: ReactNode; onSelect: () => void };

type Props = {
  /** «Desde» o «Hasta»: nombre accesible del campo. */
  label: string;
  /** Lo elegido ahora mismo; vacío muestra el placeholder. */
  value: string;
  placeholder: string;
  icon: ReactNode;
  onSelect: (place: LocatedPlace) => void;
  shortcuts?: PlaceShortcut[];
};

/**
 * Buscador de direcciones con el geocodificador de CartoCiudad (combobox de shadcn: Popover + Command).
 * Los resultados ya vienen ordenados por CartoCiudad: el filtrado local de cmdk está desactivado.
 */
export function PlaceSearch({ label, value, placeholder, icon, onSelect, shortcuts = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = usePlaceSearch(query);
  // Calles y municipios llegan sin coordenadas: se piden a CartoCiudad al elegirlos.
  const [locating, setLocating] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string>();

  const close = () => {
    setOpen(false);
    setQuery("");
    setLocating(null);
    setLocateError(undefined);
  };

  const choose = (place: Place) => {
    setLocating(place.id);
    setLocateError(undefined);
    locatePlace(place)
      .then((located) => {
        onSelect(located);
        close();
      })
      .catch((err: unknown) => {
        setLocating(null);
        setLocateError(err instanceof Error ? err.message : String(err));
      });
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`${label}: ${value || placeholder}`}
          className="h-8 w-full justify-start gap-2 bg-muted/40 px-2.5 text-xs font-normal"
        >
          <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
          <span className={cn("min-w-0 flex-1 truncate text-left", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <SearchIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Calle y número, lugar o municipio…"
            aria-label={`Buscar ${label.toLowerCase()}`}
          />
          <CommandList>
            {search.status === "idle" && shortcuts.length > 0 && (
              <CommandGroup heading="Atajos">
                {shortcuts.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      s.onSelect();
                      close();
                    }}
                  >
                    {s.icon}
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {s.detail && <span className="text-[11px] text-muted-foreground">{s.detail}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {search.status === "idle" && (
              <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
                Escribe al menos 3 letras. Con el número o el municipio sale antes («alcalá 100», «gran vía madrid»).
              </p>
            )}

            {search.status === "loading" && (
              <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" /> Buscando en CartoCiudad…
              </p>
            )}

            {search.status === "error" && <p className="px-3 py-2.5 text-xs text-destructive">{search.error}</p>}
            {locateError && <p className="px-3 py-2.5 text-xs text-destructive">{locateError}</p>}

            {search.status === "ready" && (
              <>
                <CommandEmpty className="px-3 py-2.5 text-xs text-muted-foreground">
                  Nada en la provincia de Madrid. Prueba con el número o el municipio.
                </CommandEmpty>
                <CommandGroup heading="Resultados · CartoCiudad (IGN)">
                  {search.places.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      disabled={locating !== null}
                      onSelect={() => choose(p)}
                    >
                      {locating === p.id ? (
                        <LoaderCircleIcon className="animate-spin text-muted-foreground" />
                      ) : (
                        <MapPinIcon className="text-muted-foreground" />
                      )}
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate">{p.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{p.detail}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
