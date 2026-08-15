// @ts-check
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── Ignore patterns ────────────────────────────────────────────────────
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "eslint.config.js",
      "vite.config.ts",
    ],
  },

  // ── Base JS rules ───────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript + React (browser environment) ────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion:  "latest",
        sourceType:   "module",
        ecmaFeatures: { jsx: true },
      },
      // Provide all browser globals (window, document, navigator, etc.)
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks":        reactHooks,
    },
    rules: {
      // ── TypeScript ───────────────────────────────────────────────────
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any":             "warn",
      "@typescript-eslint/no-unused-vars":              ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports":     ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // ── React — new JSX transform (React 17+) ────────────────────────
      // React no longer needs to be in scope for JSX
      "react/react-in-jsx-scope":  "off",

      // ── React Hooks ──────────────────────────────────────────────────
      ...reactHooks.configs.recommended.rules,
      // Resetting derived state in useEffect is valid (e.g. reset selection on query change)
      "react-hooks/set-state-in-effect": "off",


      // ── General quality ──────────────────────────────────────────────
      "no-console":       ["warn", { allow: ["warn", "error"] }],
      "no-debugger":      "error",
      "prefer-const":     "error",
      "no-var":           "error",
      "eqeqeq":           ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",

      // Allow console.* in the logger module (it is the logger)
      "no-restricted-syntax": "off",
    },
  },

  // ── Logger — allow all console methods ──────────────────────────────────
  {
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
