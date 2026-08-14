/**
 * @module hooks/useNewSession
 * Opens a terminal running `omp` (no --resume) to start a fresh session.
 *
 * Flow:
 * 1. Open a new tab titled "New session".
 * 2. Spawn PTY running `omp` in the user's home directory.
 * 3. omp creates a JSONL file; the FS watcher fires and updates the sidebar.
 */
import { useState, useCallback } from "react";

import { homeDir } from "@tauri-apps/api/path";

import { TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS } from "@/components/Terminal/constants";
import { newSessionPty } from "@/lib/ipc";
import { log } from "@/lib/logger";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

export interface UseNewSessionReturn {
  /** Start a new omp session — opens a terminal running `omp`. */
  startNewSession: () => Promise<void>;
  /** True while the PTY is being spawned. */
  isStarting: boolean;
}

/**
 * Provides a `startNewSession` action that opens a terminal running `omp`
 * without a session ID, creating a brand-new omp session.
 *
 * @example
 * const { startNewSession, isStarting } = useNewSession();
 */
export function useNewSession(): UseNewSessionReturn {
  const [isStarting, setIsStarting] = useState(false);
  const { openTab, setTabReady, setTabError } = useTerminalStore();
  const setActive = useSessionStore((s) => s.setActive);

  const startNewSession = useCallback(async () => {
    setIsStarting(true);

    const cwd = await homeDir().catch(() => "~");

    const tabId = openTab({
      sessionId: `__new__${Date.now()}`,
      title:     "New session",
      cwd,
    });

    if (!tabId) {
      log.warn("useNewSession: MAX_TABS reached, cannot open new session");
      setIsStarting(false);
      return;
    }

    // No existing session to set active — clear it so the right panel is blank
    setActive({ id: "", path: "", title: "New session", cwd, modified: 0, firstMessage: "" });

    try {
      await newSessionPty({ tabId, cwd, cols: TERMINAL_DEFAULT_COLS, rows: TERMINAL_DEFAULT_ROWS });
      setTabReady(tabId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("useNewSession: PTY spawn failed", { err: msg });
      setTabError(tabId, msg);
    } finally {
      setIsStarting(false);
    }
  }, [openTab, setTabReady, setTabError, setActive]);

  return { startNewSession, isStarting };
}
