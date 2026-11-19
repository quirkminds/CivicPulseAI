import type { LngLat } from "./types";

/**
 * Geocodificador de CartoCiudad (IGN/CNIG), llamado desde el navegador: tiene CORS `*` y no necesita clave.
 * Ver docs/fuentes-de-datos.md. Lo que escribe el usuario va directo a CartoCiudad, nunca a nuestra API.
 */
const GEOCODER = "https://www.cartociudad.es/geocoder/api/geocoder";

/** Sin filtro, «alcalá» devuelve antes Alcalá de Guadaíra (Sevilla) que Madrid. */
const PROVINCE = "Madrid";
const MAX_RESULTS = 8;

/** Tipos que no son direcciones ni lugares útiles como origen o destino. */
const NOISE = new Set(["expendeduria", "punto_recarga_electrica", "ngbe", "Codpost"]);

const TYPE_LABELS: Record<string, string> = {
  portal: "Dirección",
  callejero: "Calle",
  toponimo: "Lugar",
  poblacion: "Población",
  Municipio: "Municipio",
};

export type Place = {
  id: string;
  /** Tipo de CartoCiudad («portal», «callejero»…): lo pide `/find` para resolver las coordenadas. */
  type: string;
  /** «Calle Alcala 100» */
  name: string;
  /** «28009 Madrid · Dirección» */
  detail: string;
  /** null en calles, poblaciones y municipios: CartoCiudad las da a 0,0 y hay que pedirlas a `/find`. */
  coords: LngLat | null;
};

/** Lugar ya situado en el mapa. */
export type LocatedPlace = Place & { coords: LngLat };

/** Candidato tal como llega de `/candidates` (solo los campos que usamos). */
type Candidate = {
  id: string;
  type: string;
  address: string;
  muni?: string | null;
  postalCode?: string | null;
  lat: number | null;
  lng: number | null;
};

const LOWER = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "a"]);

/** CartoCiudad devuelve las vías en mayúsculas: «CALLE DE ALCALA» → «Calle de Alcala». */
export function prettify(text: string) {
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Pasa la respuesta de `/candidates` a lugares: sin ruido, sin duplicados y con coordenadas. */
export function parseCandidates(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const c of raw as Candidate[]) {
    if (NOISE.has(c.type)) continue;
    // «CALLE ALCALA 100, Madrid»: lo que va antes de la última coma es la vía; el municipio ya viene en `muni`.
    const comma = c.address.lastIndexOf(",");
    const name = prettify(comma > 0 ? c.address.slice(0, comma) : c.address);
    const key = `${name}|${c.muni ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Una calle larga trae varios códigos postales («28008 28013 28014»): entonces solo se muestra el municipio.
    const postal = c.postalCode?.includes(" ") ? null : c.postalCode;
    const where = [postal, c.muni].filter(Boolean).join(" ");
    places.push({
      id: c.id,
      type: c.type,
      name,
      detail: [where, TYPE_LABELS[c.type]].filter(Boolean).join(" · "),
      coords: toLngLat(c.lat, c.lng),
    });
    if (places.length === MAX_RESULTS) break;
  }
  return places;
}

/** Coordenadas válidas, o null si faltan (CartoCiudad usa 0,0 cuando no las incluye). */
function toLngLat(lat: number | null | undefined, lng: number | null | undefined): LngLat | null {
  if (typeof lat !== "number" || typeof lng !== "number" || (lat === 0 && lng === 0)) return null;
  return [lng, lat];
}

/** Coordenadas de la respuesta de `/find`. */
export function parseFind(raw: unknown): LngLat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { lat?: number | null; lng?: number | null };
  return toLngLat(r.lat, r.lng);
}

/** Sitúa un lugar en el mapa: si el candidato no traía coordenadas, las pide a `/find`. */
export async function locatePlace(place: Place, signal?: AbortSignal): Promise<LocatedPlace> {
  if (place.coords) return { ...place, coords: place.coords };
  const qs = new URLSearchParams({ id: place.id, type: place.type });
  const res = await fetch(`${GEOCODER}/find?${qs}`, { signal });
  const coords = res.ok ? parseFind(await res.json()) : null;
  if (!coords) throw new Error(`CartoCiudad no sabe dónde está «${place.name}». Prueba con un número de portal.`);
  return { ...place, coords };
}

/** Busca direcciones, calles y lugares de la provincia de Madrid. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const qs = new URLSearchParams({ q: query, limit: "15", provincia_filter: PROVINCE });
  const res = await fetch(`${GEOCODER}/candidates?${qs}`, { signal });
  if (!res.ok) throw new Error("El buscador de CartoCiudad no responde ahora mismo.");
  return parseCandidates(await res.json());
}

type Reverse = {
  address?: string | null;
  tip_via?: string | null;
  portalNumber?: number | null;
  muni?: string | null;
};

/** Nombre legible de la dirección más cercana a un punto, o null si no hay ninguna. */
export function parseReverse(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Reverse;
  if (!r.address) return null;
  const street = prettify([r.tip_via, r.address, r.portalNumber || null].filter(Boolean).join(" "));
  return r.muni ? `${street}, ${r.muni}` : street;
}

/** Dirección del portal más cercano (en 350 m) a un punto: «Plaza Puerta del Sol 7, Madrid». */
export async function reverseGeocode([lng, lat]: LngLat, signal?: AbortSignal): Promise<string | null> {
  const qs = new URLSearchParams({ lon: String(lng), lat: String(lat) });
  const res = await fetch(`${GEOCODER}/reverseGeocode?${qs}`, { signal });
  if (!res.ok) return null;
  // Sin dirección cerca (p. ej. en el campo), CartoCiudad responde 204 sin cuerpo.
  const text = await res.text();
  return text ? parseReverse(JSON.parse(text)) : null;
}
