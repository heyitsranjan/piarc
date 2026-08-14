/**
 * @module lib/logger
 * Structured application logger for the frontend.
 *
 * Wraps `@tauri-apps/plugin-log` to write logs to:
 * - macOS: `~/Library/Logs/com.oh-my-pi.app/`
 * - Windows: `%APPDATA%\com.oh-my-pi.app\logs\`
 * - Linux: `~/.local/share/com.oh-my-pi.app/logs/`
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

/** Serialise extra context to a string appended to the message. */
function ctx(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return "";
  return "  " + JSON.stringify(context);
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
