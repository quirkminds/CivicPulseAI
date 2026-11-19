import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { parseEnv } from "./src/env.ts";

export default defineConfig(({ mode }) => {
  // Falla aquí (al arrancar dev o build) con un .env malo, nunca en el navegador.
  parseEnv(loadEnv(mode, import.meta.dirname, "VITE_"));

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    server: { port: 5173 },
  };
});
