import { parseEnv } from "./env.ts";

/** URL base de la API ("" = mismo origen, vía proxy de Vite), o `undefined` para usar los datos de ejemplo. */
export const API_URL = parseEnv(import.meta.env).VITE_API_URL?.replace(/\/$/, "");
