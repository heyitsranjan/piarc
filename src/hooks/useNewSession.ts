/**
 * @module hooks/useNewSession
 * Opens a terminal running `omp` (no --resume) to start a fresh session.
 *
 * Flow:
 * 1. Open a new tab titled "New session".
 * 2. Spawn PTY running `omp` in the user's home directory.
 * 3. omp creates a JSONL file; the FS watcher fires and updates the sidebar.
 */
import { useCallback, useState } from "react";

import { homeDir } from "@tauri-apps/api/path";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { newSessionPty, shellPty } from "@/lib/ipc";
import { log } from "@/lib/logger";

export interface UseNewSessionReturn {
  /** Start a new omp session — opens a terminal running `omp`. */
  startNewSession: () => Promise<void>;
  /** Open a plain login shell without starting omp. */
  startTerminal: () => Promise<void>;
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
  const ompAvailable = useOmpStore((state) => state.status?.installed ?? false);
  const { openTab, setTabReady, setTabError } = useTerminalStore();
  const setActive = useSessionStore((s) => s.setActive);
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);

  const start = useCallback(
    async (kind: "omp" | "terminal") => {
      if (kind === "omp" && !ompAvailable) {
        log.warn("Cannot start OMP session: OMP is unavailable");
        return;
      }
      setIsStarting(true);
      const cwd = await homeDir().catch(() => "~");
      const isTerminal = kind === "terminal";
      const title = isTerminal ? "Terminal" : "New session";
      const tabId = openTab({
        kind,
        sessionId: isTerminal ? `__terminal__${Date.now()}` : `__new__${Date.now()}`,
        title,
        cwd,
      });

      if (!tabId) {
        log.warn("useNewSession: MAX_TABS reached");
        setIsStarting(false);
        return;
      }
      setSidebarMode(isTerminal ? "terminals" : "sessions");

      setActive(
        isTerminal
          ? null
          : { id: "", path: "", title, cwd, modified: 0, firstMessage: "" }
      );

      try {
        const params = {
          tabId,
          cwd,
          cols: TERMINAL_DEFAULT_COLS,
          rows: TERMINAL_DEFAULT_ROWS,
        };
        await (isTerminal ? shellPty(params) : newSessionPty(params));
        setTabReady(tabId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("useNewSession: PTY spawn failed", { err: msg });
        setTabError(tabId, msg);
      } finally {
        setIsStarting(false);
      }
    },
    [ompAvailable, openTab, setTabReady, setTabError, setActive, setSidebarMode]
  );

  const startNewSession = useCallback(() => start("omp"), [start]);
  const startTerminal = useCallback(() => start("terminal"), [start]);

  return { startNewSession, startTerminal, isStarting };
}
