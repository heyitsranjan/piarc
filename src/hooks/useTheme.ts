/**
 * @module hooks/useTheme
 * Applies the active theme to the `<html>` element and reacts to OS changes.
 * Must be called once near the root of the component tree.
 */
import { useEffect } from "react";

import type { Theme } from "@/store/ui";
import { useUiStore } from "@/store/ui";

/**
 * Syncs the selected `Theme` with the `dark` / `light` class on `<html>`.
 * When theme is `"system"`, follows `prefers-color-scheme` media query.
 *
 * @example
 * // In App.tsx or Layout:
 * useTheme();
 */
export function useTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const apply = (t: Theme) => {
      const isDark =
        t === "dark" ||
        (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
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
