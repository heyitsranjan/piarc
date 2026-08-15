/**
 * @module constants
 * App-wide compile-time constants.
 * Change here; every consumer updates automatically.
 */

/** Maximum number of concurrent terminal tabs. */
export const MAX_TABS = 12;

/** Maximum number of PTY processes kept alive in the Rust cache (LRU). */
export const PTY_CACHE_SIZE = 8;

/** Debounce delay (ms) before re-running session search. */
export const SEARCH_DEBOUNCE_MS = 120;

/** Tauri event name emitted by the FS watcher when sessions change. */
export const EVENT_SESSIONS_UPDATED = "sessions_updated";

/** Tauri event name prefix for PTY output; full name = `pty_output:${tabId}`. */
export const EVENT_PTY_OUTPUT_PREFIX = "pty_output";

/** Tauri event name emitted when a PTY process exits. */
export const EVENT_PTY_EXIT_PREFIX = "pty_exit";
