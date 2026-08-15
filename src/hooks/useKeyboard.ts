/**
 * @module hooks/useKeyboard
 * Global keyboard shortcut registration hook.
 *
 * Centralises all app-wide hotkeys so shortcuts don't scatter across components.
 * Called once at the App level; individual components call it with their own
 * handlers for feature-specific shortcuts.
 */
import { useEffect } from "react";

/** A keyboard shortcut descriptor. */
export interface Shortcut {
  /** Key name, matched against `KeyboardEvent.key` and physical letter/digit codes. */
  key: string;
  /** Require ⌘ (macOS) or Ctrl (Win/Linux). Defaults to false. */
  meta?: boolean;
  /** Require Alt/Option. Defaults to false. */
  alt?: boolean;
  /** Require Shift. Defaults to false. */
  shift?: boolean;
  /** Handler called when the shortcut fires. */
  handler: (e: KeyboardEvent) => void;
}

/**
 * Register one or more keyboard shortcuts for the lifetime of the component.
 * Shortcuts are automatically removed on unmount.
 *
 * @param shortcuts - Array of shortcut descriptors.
 *
 * @example
 * useKeyboard([
 *   { key: "k", meta: true, handler: openPalette },
 *   { key: "Escape",        handler: closePalette },
 * ]);
 */
export function useKeyboard(shortcuts: Shortcut[]): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const metaMatch = s.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const code =
          s.key.length === 1
            ? /^\d$/.test(s.key)
              ? `Digit${s.key}`
              : `Key${s.key.toUpperCase()}`
            : "";
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase() || e.code === code;
        if (keyMatch && metaMatch && altMatch && shiftMatch) {
          e.preventDefault();
          s.handler(e);
          return; // first match wins
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
