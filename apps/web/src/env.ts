import * as v from "valibot";

/** Variables públicas de la web. Se validan en vite.config.ts: un valor malo para dev/build, nunca el navegador. */
const EnvSchema = v.object({
  // Una URL absoluta, o «/» para llamar a la API en el mismo origen a través del proxy de Vite (un solo puerto).
  VITE_API_URL: v.optional(
    v.union([v.literal("/"), v.pipe(v.string(), v.url())], "VITE_API_URL debe ser una URL o «/»"),
  ),
});

export type Env = v.InferOutput<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = v.safeParse(EnvSchema, raw);
  if (!result.success) {
    throw new Error(`.env no válido: ${result.issues.map((i) => i.message).join("; ")}`);
  }
  return result.output;
}
