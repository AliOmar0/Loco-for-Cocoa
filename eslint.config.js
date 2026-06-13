import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "app.js",
      "styles.css",
      "tests/browser-smoke.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
        fetch: "readonly",
        WebSocket: "readonly",
      },
    },
  },
  {
    files: ["api/**/*.ts", "server/**/*.ts", "scripts/**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
      },
    },
  },
);
