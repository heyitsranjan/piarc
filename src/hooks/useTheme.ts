/**
 * @module hooks/useTheme
 * Applies the active theme class to `<html>` and reacts to OS changes.
 *
 * Uses class-based toggling (`html.dark` / `html.light`) rather than a
 * `@media` block so manual overrides in the UI work correctly.
 * CSS transitions on `html` give a smooth fade when switching themes.
 */
import { useEffect } from "react";

import type { Theme } from "@/store/ui";
import { useUiStore } from "@/store/ui";

/**
 * Syncs the chosen `Theme` with `.dark` / `.light` classes on `<html>`.
 * Call once near the root — in `App.tsx`.
 *
 * @example
 * useTheme(); // in App component
 */
export function useTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const apply = (t: Theme) => {
      const isDark =
        t === "dark" ||
        (t === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark",  isDark);
      document.documentElement.classList.toggle("light", !isDark);
    };

    apply(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => apply("system");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);
}
