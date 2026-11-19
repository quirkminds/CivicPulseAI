import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["**/dist/**", ".agents/**", ".claude/**", ".cursor/**"],
  // react/jsx-a11y sobre los defaults: las reglas de hooks pillan bugs de efectos; las de a11y, de marcado.
  plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    // Mejor useEffectEvent que desactivar esta regla (React 19.2+).
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-has-content": "error",
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/heading-has-content": "error",
    "jsx-a11y/html-has-lang": "error",
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/no-autofocus": "error",
    "oxc/no-accumulating-spread": "error",
  },
  overrides: [
    {
      // Generado por shadcn/mapcn: se actualiza con el CLI, no a mano.
      files: ["apps/web/src/components/ui/**"],
      rules: { "react-hooks/exhaustive-deps": "off", "react/only-export-components": "off" },
    },
  ],
});
