import type { Campus, LngLat } from "./types";

export const CAMPUS_SUR: Campus = {
  id: "campus-sur",
  name: "Campus Sur",
  school: "ETSISI · UPM",
  coords: [-3.6283, 40.3896],
};

export const MONTEGANCEDO: Campus = {
  id: "montegancedo",
  name: "Campus de Montegancedo",
  school: "ETSIINF · UPM",
  coords: [-3.8399, 40.4055],
};

export const CAMPUSES: Campus[] = [CAMPUS_SUR, MONTEGANCEDO];

/** Origen por defecto mientras no haya geocodificación: Puerta del Sol. */
export const DEFAULT_ORIGIN: { label: string; coords: LngLat } = {
  label: "Puerta del Sol, Madrid",
  coords: [-3.7038, 40.4168],
};
