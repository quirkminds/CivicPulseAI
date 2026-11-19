import {
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  CircleDotIcon,
  CornerLeftDownIcon,
  CornerRightDownIcon,
  CornerUpLeftIcon,
  CornerUpRightIcon,
  FlagIcon,
  type LucideIcon,
  MergeIcon,
  RotateCwIcon,
  ShipIcon,
  Undo2Icon,
} from "lucide-react";
import { formatStepDistance } from "@/lib/navigation";
import type { LngLat, Maneuver, ManeuverType } from "@/lib/types";

const ICONS: Record<ManeuverType, LucideIcon> = {
  start: CircleDotIcon,
  arrive: FlagIcon,
  straight: ArrowUpIcon,
  "slight-right": ArrowUpRightIcon,
  right: CornerUpRightIcon,
  "sharp-right": CornerRightDownIcon,
  "u-turn": Undo2Icon,
  "sharp-left": CornerLeftDownIcon,
  left: CornerUpLeftIcon,
  "slight-left": ArrowUpLeftIcon,
  "exit-right": ArrowUpRightIcon,
  "exit-left": ArrowUpLeftIcon,
  merge: MergeIcon,
  roundabout: RotateCwIcon,
  "roundabout-exit": ArrowUpRightIcon,
  ferry: ShipIcon,
};

/**
 * Indicaciones paso a paso de Valhalla, en castellano. Cada paso muestra la distancia hasta el siguiente;
 * al pulsarlo, el mapa vuela al punto de la maniobra.
 */
export function ManeuverList({
  maneuvers,
  onFocusPoint,
}: {
  maneuvers: Maneuver[];
  onFocusPoint?: (coords: LngLat) => void;
}) {
  return (
    <ol className="grid max-h-72 gap-0.5 overflow-y-auto pr-1">
      {maneuvers.map((m, i) => {
        const Icon = ICONS[m.type];
        return (
          <li key={`${m.beginIndex}-${i}`}>
            <button
              type="button"
              onClick={() => onFocusPoint?.(m.position)}
              className="flex w-full items-start gap-2.5 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{m.instruction}</span>
              {m.distanceM > 0 && (
                <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {formatStepDistance(m.distanceM)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
