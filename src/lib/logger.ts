/**
 * @module lib/logger
 * Structured application logger for the frontend.
 *
 * Writes structured, privacy-filtered logs to OMPX's platform log directory.
 *
 * Falls back to `console.*` when running outside Tauri (e.g. browser dev).
 *
 * Usage:
 * ```ts
 * import { log } from "@/lib/logger";
 * log.info("session loaded", { count: 5 });
 * log.error("PTY failed", { tabId, error: err.message });
 * ```
 */
import { debug, error, info, trace, warn } from "@tauri-apps/plugin-log";

/** Serialize context without persisting arbitrary strings or structured user data. */
function ctx(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return "";
  const safe = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      typeof value === "number" || typeof value === "boolean" ? value : "[redacted]",
    ])
  );
  return "  " + JSON.stringify(safe);
}

/** Whether we are running inside the Tauri shell (not a bare browser). */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type LogFn = (msg: string, context?: Record<string, unknown>) => void;

function makeLevel(
  tauriFn: (msg: string) => Promise<void>,
  consoleFn: (...args: unknown[]) => void
): LogFn {
  return (msg, context) => {
    const full = msg + ctx(context);
    if (IS_TAURI) {
      tauriFn(full).catch(() => consoleFn(full));
    } else {
      consoleFn(full);
    }
  };
}

/**
 * Application logger.
 *
 * All log levels write to the platform log file AND the DevTools console.
 * Log level filter is configured in `lib.rs` via `tauri_plugin_log`.
 */
export const log = {
  /** Critical error — something broke that needs user attention. */
  error: makeLevel(error, console.error),
  /** Non-fatal warning — degraded behaviour, user may notice. */
  warn: makeLevel(warn, console.warn),
  /** Normal operational event (session load, tab open, etc.). */
  info: makeLevel(info, console.info),
  /** Verbose diagnostic event, off by default in production builds. */
  debug: makeLevel(debug, console.debug),
  /** Extremely verbose trace — raw PTY bytes, resize events, etc. */
  trace: makeLevel(trace, console.debug),
};
