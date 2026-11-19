import { Barrio } from "@/features/barrio/barrio";
import { Specimen, Surface } from "../components/specimen";

export function BarrioPage() {
  return (
    <Specimen title="Atlas territorial" description="Callejero, coropleta del INE y ficha flotante de zona.">
      <Surface className="h-[42rem] [&>*]:w-full">
        <Barrio />
      </Surface>
    </Specimen>
  );
}
