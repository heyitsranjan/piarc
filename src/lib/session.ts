/**
 * @module session
 * Session type definitions and pure formatting utilities.
 * Mirrors the `OmpSession` struct returned by the Rust `list_sessions` command.
 * No React, no Tauri imports — safe to use anywhere.
 */

/** A single omp agent session parsed from a ~/.omp/agent/sessions JSONL file. */
export interface OmpSession {
  /** UUID from the session header (`{"type":"session","id":"..."}`) */
  id: string;
  /** Absolute path to the .jsonl file on disk */
  path: string;
  /** Display name: title slot > header title > first user message > "Untitled" */
  title: string;
  /** Working directory recorded in the session header */
  cwd: string;
  /** File mtime as a Unix timestamp (seconds) */
  modified: number;
  /** First user message — used as subtitle and for full-text search */
  firstMessage: string;
}

/**
 * Format a Unix timestamp as a human-readable relative duration.
 *
 * @example
 * timeAgo(Date.now() / 1000 - 300)   // → "5m ago"
 * timeAgo(Date.now() / 1000 - 7200)  // → "2h ago"
 * timeAgo(Date.now() / 1000 - 90000) // → "1d ago"
 */
export function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

/**
 * Shorten an absolute path for sidebar display.
 * Replaces the user's home directory prefix with `~`.
 *
 * @example
 * cwdShort("/Users/smruti/Developer/foo") // → "~/Developer/foo"
 * cwdShort("C:\\Users\\smruti\\projects")  // → "~\\projects"
 */
export function cwdShort(cwd: string): string {
  const macLinux = cwd.match(/^\/(?:Users|home)\/[^/]+/);
  if (macLinux) return "~" + cwd.slice(macLinux[0].length);
  const windows = cwd.match(/^[A-Z]:\\Users\\[^\\]+/i);
  if (windows) return "~" + cwd.slice(windows[0].length);
  return cwd;
}

/**
 * Shell-escape a file-system path for safe embedding in a `-c` argument.
 * Wraps in single quotes and escapes any embedded single quotes.
 *
 * @example
 * shellEscapePath("/home/foo/my project") // → "'/home/foo/my project'"
 */
export function shellEscapePath(p: string): string {
  return "'" + p.replace(/'/g, "'\\''") + "'";
}
