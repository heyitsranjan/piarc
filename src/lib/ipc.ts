/**
 * @module ipc
 * Type-safe wrappers around every Tauri `invoke()` call.
 *
 * Rules enforced here:
 * - Components and hooks NEVER import or call `invoke()` directly.
 * - All Tauri command names are string literals defined in this file.
 * - Param/return types mirror the corresponding Rust command signatures exactly.
 * - Adding a new backend command = add one export here + update Rust commands/.
 */
import { invoke } from "@tauri-apps/api/core";

import type { OmpSession } from "@/lib/session";

// ─── Sessions ──────────────────────────────────────────────────────────────

/**
 * Fetch all omp sessions from `~/.omp/agent/sessions/`, sorted newest-first.
 * Reads only the first 4 KiB of each JSONL file (title slot + session header).
 */
export const listSessions = (): Promise<OmpSession[]> => invoke("list_sessions");

/**
 * Permanently delete a session JSONL file from disk.
 * @param path - Absolute path to the `.jsonl` file returned by `listSessions`.
 */
export const deleteSession = (path: string): Promise<void> =>
  invoke("delete_session", { path });

// ─── Terminal / PTY ────────────────────────────────────────────────────────

/** Parameters required to spawn a new PTY process for a terminal tab. */
export interface CreatePtyParams {
  /** Unique tab ID — used as the PTY cache key in Rust `AppState`. */
  tabId: string;
  /** omp session UUID (`omp --resume <sessionId>`). */
  sessionId: string;
  /** Working directory; the shell `cd`s here before launching omp. */
  cwd: string;
  /** Initial terminal column count (from xterm.js `Terminal.cols`). */
  cols: number;
  /** Initial terminal row count (from xterm.js `Terminal.rows`). */
  rows: number;
  /** Index signature required by Tauri's `InvokeArgs` constraint. */
  [key: string]: unknown;
}

/**
 * Spawn a PTY process for `tabId` and store it in the Rust LRU cache.
 * Emits `pty_output:<tabId>` events with base64-encoded output chunks.
 * Emits `pty_exit:<tabId>` when the process terminates.
 */
export const createPty = (params: CreatePtyParams): Promise<void> =>
  invoke("create_pty", params);

/**
 * Write raw input bytes (keyboard / paste) into the PTY for `tabId`.
 * @param tabId - Must match an active PTY in the Rust cache.
 * @param data  - UTF-8 string to write (key presses, escape sequences, etc.).
 */
export const writePty = (tabId: string, data: string): Promise<void> =>
  invoke("write_pty", { tabId, data });

/**
 * Notify the PTY of a terminal resize (triggers SIGWINCH on Unix).
 * Call this whenever the xterm.js container changes size.
 */
export const resizePty = (tabId: string, cols: number, rows: number): Promise<void> =>
  invoke("resize_pty", { tabId, cols, rows });

/**
 * Kill the PTY process and evict it from the Rust cache.
 * Safe to call even if the process has already exited.
 */
export const killPty = (tabId: string): Promise<void> => invoke("kill_pty", { tabId });

/**
 * Pre-warm a PTY for a session without associating it with a visible tab.
 * The Rust backend spawns the process and holds it in the LRU cache so the
 * first time the user clicks this session the terminal is already running.
 *
 * @param sessionId - omp session UUID.
 * @param cwd       - Working directory for the shell.
 */
export const prewarmPty = (sessionId: string, cwd: string): Promise<void> =>
  invoke("prewarm_pty", { sessionId, cwd });

/** Parameters for spawning a fresh omp session (no --resume). */
export interface NewSessionPtyParams {
  /** Unique tab ID — PTY cache key in Rust AppState. */
  tabId: string;
  /** Working directory; omp creates the session file here. */
  cwd: string;
  /** Initial terminal column count. */
  cols: number;
  /** Initial terminal row count. */
  rows: number;
  /** Index signature required by Tauri's InvokeArgs constraint. */
  [key: string]: unknown;
}

/**
 * Spawn a PTY running `omp` directly (no session ID, no --resume).
 * omp starts a fresh session and creates a new JSONL file on disk.
 * The FS watcher picks it up and the sidebar updates automatically.
 */
export const newSessionPty = (params: NewSessionPtyParams): Promise<void> =>
  invoke("new_session_pty", params);
