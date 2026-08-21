/**
 * @module hooks/useNewSession
 * Creates fresh terminal tabs — either an OMP agent session or a plain shell.
 *
 * Flow for agent sessions:
 * 1. Ask the user to choose a working directory.
 * 2. Open a new tab and spawn its PTY running the agent binary.
 * 3. The agent creates a session file; the FS watcher updates the sidebar.
 *
 * Flow for plain terminals:
 * 1. Ask the user to choose a working directory.
 * 2. Open a new tab and spawn a plain login shell.
 */
import { useCallback, useState } from "react";

import { open } from "@tauri-apps/plugin-dialog";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";

import { useOmpStore } from "@/store/omp";
import { AGENT_START_CMD, type AgentType, useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { newSessionPty, shellPty } from "@/lib/ipc";
import { log } from "@/lib/logger";

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseNewSessionReturn {
  /** Start a new OMP agent session — opens a terminal running `omp`. */
  startNewSession: () => Promise<void>;
  /** Open a plain login shell without starting any agent. */
  startTerminal: () => Promise<void>;
  /** `true` while the PTY is being spawned. */
  isStarting: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Provides actions to start a new OMP session or a plain terminal.
 *
 * @example
 * const { startNewSession, startTerminal, isStarting } = useNewSession();
 */
export function useNewSession(): UseNewSessionReturn {
  const [isStarting, setIsStarting] = useState(false);
  const ompAvailable = useOmpStore((state) => state.status?.installed ?? false);
  const { openTab, setTabReady, setTabError } = useTerminalStore();
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);
  const prependSidebarOrder = useUiStore((state) => state.prependSidebarOrder);

  /**
   * @internal Core factory — opens a tab for the given agent (or plain shell).
   * `agent: null` → plain shell; `agent: AgentType` → AI-backed terminal.
   */
  const start = useCallback(
    async (agent: AgentType | null) => {
      if (agent === "omp" && !ompAvailable) {
        log.warn("Cannot start OMP session: OMP is unavailable");
        return;
      }

      setIsStarting(true);

      const isPlainShell = agent === null;
      const cwd = await open({
        directory: true,
        multiple: false,
        title: isPlainShell
          ? "Choose location for new terminal"
          : "Choose location for new PiArc session",
      }).catch((reason) => {
        log.error("useNewSession: folder selection failed", {
          err: reason instanceof Error ? reason.message : String(reason),
        });
        return null;
      });

      if (typeof cwd !== "string") {
        setIsStarting(false);
        return;
      }

      const tabId = openTab({
        id: crypto.randomUUID(),
        kind: "terminal",
        agent,
        startCmd: agent !== null ? AGENT_START_CMD[agent] : null,
        resumeCmd: null,
        path: "",
        firstMessage: "",
        sessionId: isPlainShell ? `__terminal__${Date.now()}` : `__new__${Date.now()}`,
        title: isPlainShell ? "Terminal" : "New session",
        cwd,
      });

      setSidebarMode("all");
      prependSidebarOrder(tabId);

      try {
        const params = {
          tabId,
          agent: agent ?? "omp",
          cwd,
          cols: TERMINAL_DEFAULT_COLS,
          rows: TERMINAL_DEFAULT_ROWS,
        };
        await (isPlainShell ? shellPty(params) : newSessionPty(params));
        setTabReady(tabId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("useNewSession: PTY spawn failed", { err: msg });
        setTabError(tabId, msg);
      } finally {
        setIsStarting(false);
      }
    },
    [ompAvailable, openTab, setTabReady, setTabError, setSidebarMode, prependSidebarOrder]
  );

  const startNewSession = useCallback(() => start("omp"), [start]);
  const startTerminal = useCallback(() => start(null), [start]);

  return { startNewSession, startTerminal, isStarting };
}
