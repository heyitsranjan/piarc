/**
 * @module components/Terminal/constants
 * Default terminal dimensions used before xterm.js measures its container.
 * The actual `FitAddon` resize fires immediately after mount.
 */

/** Fallback column count for PTY creation before FitAddon measures size. */
export const TERMINAL_DEFAULT_COLS = 120;

/** Fallback row count for PTY creation before FitAddon measures size. */
export const TERMINAL_DEFAULT_ROWS = 30;
