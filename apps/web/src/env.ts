import * as v from "valibot";

/** Variables públicas de la web. Se validan en vite.config.ts: un valor malo para dev/build, nunca el navegador. */
const EnvSchema = v.object({
  VITE_API_URL: v.optional(v.pipe(v.string(), v.url("VITE_API_URL debe ser una URL"))),
});

export type Env = v.InferOutput<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = v.safeParse(EnvSchema, raw);
  if (!result.success) {
    throw new Error(`.env no válido: ${result.issues.map((i) => i.message).join("; ")}`);
  }
  return result.output;
}
