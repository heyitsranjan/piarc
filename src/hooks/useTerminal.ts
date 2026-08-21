/**
 * @module hooks/useTerminal
 * High-level terminal tab operations.
 *
 * Handles all lifecycle transitions for a tab:
 * - opening → loading → ready (PTY live)
 * - opening → loading → error (PTY spawn failed)
 * - retry   → loading → ready | error
 * - refresh → kill current PTY → loading → ready | error
 *
 * Components call these instead of wiring store + IPC directly.
 */
import { useCallback } from "react";

import { useEnvStore } from "@/store/env";
import {
  AGENT_START_CMD,
  type AgentType,
  type Tab,
  agentResumeCmd,
  useTerminalStore,
} from "@/store/terminal";

import { createPty, shellPty } from "@/lib/ipc";
import type { OmpSession } from "@/lib/session";
import { shortId } from "@/lib/utils";

/** Module-scoped dedup guard: prevents concurrent refresh of the same session. */
const refreshingSessionIds = new Set<string>();

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseTerminalReturn {
  /**
   * Open or switch to an agent tab for `session`.
   * - Existing tab for the session → switch to it (no new PTY).
   * - Existing tab with error → retry PTY spawn.
   * - No tab → create tab, spawn PTY, handle loading/error transitions.
   *
   * `agent` defaults to `"omp"` when not provided (e.g. CommandPalette
   * searches OMP sessions on disk).
   */
  openSession: (
    session: OmpSession,
    cols: number,
    rows: number,
    agent?: AgentType
  ) => Promise<void>;

  /** Close a tab and kill its PTY. */
  closeTab: (tabId: string) => Promise<void>;

  /** Switch the active visible tab. */
  switchTab: (tabId: string) => void;

  /**
   * Retry a failed tab: reset to `isLoading = true` and re-spawn the PTY.
   * Reads the current tab shape from the store — no stale closures.
   */
  retryTab: (tabId: string, cols: number, rows: number) => Promise<void>;

  /**
   * Restart an agent session in a fresh PTY, discarding any running command.
   * Preserves the existing tab ID so sidebar order stays stable.
   * Deduplicated: concurrent calls for the same session are no-ops.
   *
   * `agent` defaults to `"omp"` when not provided.
   */
  refreshSession: (
    session: OmpSession,
    cols: number,
    rows: number,
    agent?: AgentType
  ) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Provides high-level terminal tab operations with full lifecycle error handling.
 *
 * @example
 * const { openSession, retryTab } = useTerminal();
 * await openSession(session, 120, 30);
 */
export function useTerminal(): UseTerminalReturn {
  const {
    tabs,
    openTab,
    closeTab,
    setActiveTab,
    setTabReady,
    setTabError,
    retryTab: markRetry,
  } = useTerminalStore();

  /**
   * @internal Spawn or re-spawn the PTY for an already-opened tab.
   * Routes to `shellPty` for plain terminals, `createPty` for all agent types.
   */
  const spawnPty = useCallback(
    async (
      tabId: string,
      tab: Pick<Tab, "agent" | "sessionId" | "cwd">,
      cols: number,
      rows: number
    ) => {
      try {
        const env = useEnvStore.getState().toRecord();
        const params = { tabId, cwd: tab.cwd, cols, rows, env };
        await (tab.agent === null
          ? shellPty(params)
          : createPty({
              ...params,
              agent: tab.agent,
              sessionId: tab.sessionId,
            }));
        setTabReady(tabId);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to start terminal process";
        setTabError(tabId, message);
      }
    },
    [setTabReady, setTabError]
  );

  const openSession = useCallback(
    async (session: OmpSession, cols: number, rows: number, agent: AgentType = "omp") => {
      // Reuse existing tab — avoids duplicate PTYs for the same session.
      const existing = tabs.find((t) => t.sessionId === session.id);
      if (existing) {
        setActiveTab(existing.id);
        // Reconnect when error is set OR tab is in disconnected state
        // (disconnected with no error happens when synced via useSyncSessions
        // before inactive:true, or when activity was reset without setting error).
        const needsReconnect =
          !!existing.error || existing.activity.state === "disconnected";
        if (needsReconnect) {
          markRetry(existing.id);
          await spawnPty(existing.id, existing, cols, rows);
        }
        return;
      }

      const tabId = openTab({
        kind: "terminal",
        agent,
        startCmd: AGENT_START_CMD[agent],
        resumeCmd: agentResumeCmd(agent, session.id),
        path: session.path,
        firstMessage: session.firstMessage,
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
      });

      await spawnPty(
        tabId,
        { agent, sessionId: session.id, cwd: session.cwd },
        cols,
        rows
      );
    },
    [tabs, openTab, setActiveTab, markRetry, spawnPty]
  );

  const retryTab = useCallback(
    async (tabId: string, cols: number, rows: number) => {
      const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      markRetry(tabId); // isLoading = true, error = null
      await spawnPty(tabId, tab, cols, rows);
    },
    [markRetry, spawnPty]
  );

  const refreshSession = useCallback(
    async (session: OmpSession, cols: number, rows: number, agent: AgentType = "omp") => {
      if (refreshingSessionIds.has(session.id)) return;
      refreshingSessionIds.add(session.id);

      try {
        const existing = useTerminalStore
          .getState()
          .tabs.find((tab) => tab.sessionId === session.id);

        // Preserve the existing tab ID so sidebarOrder stays stable.
        // A brand-new session uses session.id as its tab ID.
        const tabId = existing?.id ?? `tab-${shortId()}`;

        if (existing) await closeTab(existing.id);

        const newTabId = openTab({
          id: tabId,
          kind: "terminal",
          agent,
          startCmd: AGENT_START_CMD[agent],
          resumeCmd: agentResumeCmd(agent, session.id),
          path: session.path,
          firstMessage: session.firstMessage,
          sessionId: session.id,
          title: session.title,
          cwd: session.cwd,
        });

        await spawnPty(
          newTabId,
          { agent, sessionId: session.id, cwd: session.cwd },
          cols,
          rows
        );
      } finally {
        refreshingSessionIds.delete(session.id);
      }
    },
    [closeTab, openTab, spawnPty]
  );

  return { openSession, closeTab, switchTab: setActiveTab, retryTab, refreshSession };
}
