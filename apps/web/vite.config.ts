import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { parseEnv } from "./src/env.ts";

export default defineConfig(({ mode }) => {
  // Falla aquí (al arrancar dev o build) con un .env malo, nunca en el navegador.
  parseEnv(loadEnv(mode, import.meta.dirname, "VITE_"));
  // Solo para el servidor de desarrollo (sin prefijo VITE_, no llega al navegador).
  const apiTarget = loadEnv(mode, import.meta.dirname, "API_").API_PROXY_TARGET ?? "http://localhost:8080";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      // Con VITE_API_URL=/ la web llama a /v1/... en su propio origen y Vite lo reenvía a la API:
      // toda la app se ve desde un solo puerto.
      proxy: { "/v1": apiTarget, "/healthz": apiTarget },
    },
  };
});
