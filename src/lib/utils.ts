/**
 * @module utils
 * Generic utility functions — no React, no Tauri, no store dependencies.
 * Each function is independently testable.
 */

/**
 * Merge Tailwind class names conditionally (lightweight `clsx` replacement).
 * Filters out falsy values so callers can use inline ternaries cleanly.
 *
 * @example
 * cn("px-3 py-2", isActive && "bg-accent", className)
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Debounce a function — returns a new function that delays invoking `fn`
 * until `wait` ms have elapsed since the last call.
 *
 * @param fn   - The function to debounce.
 * @param wait - Delay in milliseconds.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Generate a short random ID suitable for tab identifiers.
 * Not cryptographically secure — use only for UI state keys.
 */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Clamp a number between `min` and `max` (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
