/**
 * @module hooks/useTerminal
 * High-level terminal tab operations.
 *
 * Handles all lifecycle transitions for a tab:
 * - opening → loading → ready (PTY live)
 * - opening → loading → error (PTY spawn failed)
 * - retry   → loading → ready | error
 * - refresh → kill current PTY → loading → ready | error
 * Components call these instead of wiring store + IPC manually.
 */
import { useCallback } from "react";

import { type Tab, useTerminalStore } from "@/store/terminal";

import { createPty, shellPty } from "@/lib/ipc";
import type { OmpSession } from "@/lib/session";

const refreshingSessionIds = new Set<string>();

export interface UseTerminalReturn {
  /**
   * Open or switch to a terminal tab for `session`.
   * - If a tab already exists for the session → switches to it (no new PTY).
   * - Otherwise → creates tab, spawns PTY, handles loading/error transitions.
   */
  openSession: (session: OmpSession, cols: number, rows: number) => Promise<void>;

  /** Close a tab and kill its PTY. */
  closeTab: (tabId: string) => Promise<void>;

  /** Switch the active visible tab. */
  switchTab: (tabId: string) => void;

  /**
   * Retry a failed tab.
   * Resets the tab to `isLoading = true` and re-attempts PTY spawn.
   */
  retryTab: (tabId: string, cols: number, rows: number) => Promise<void>;

  /**
   * Restart one OMP session in a fresh tab and PTY.
   * Any running command, unsent input, and transient shell state are discarded.
   */
  refreshSession: (session: OmpSession, cols: number, rows: number) => Promise<void>;
}

/**
 * Provides high-level terminal tab operations with full error handling.
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
  /** Internal: spawn PTY for an already-opened tab. */
  const spawnPty = useCallback(
    async (
      tabId: string,
      tab: Pick<Tab, "kind" | "sessionId" | "cwd">,
      cols: number,
      rows: number
    ) => {
      try {
        const params = { tabId, cwd: tab.cwd, cols, rows };
        await (tab.kind === "terminal"
          ? shellPty(params)
          : createPty({ ...params, sessionId: tab.sessionId }));
        setTabReady(tabId);
      } catch (err) {
        // Surface the Rust error string to the UI — user can retry
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
    async (session: OmpSession, cols: number, rows: number) => {
      // Reuse an existing tab for this session rather than opening a duplicate
      const existing = tabs.find((t) => t.sessionId === session.id);
      if (existing) {
        setActiveTab(existing.id);
        if (existing.error) {
          markRetry(existing.id);
          await spawnPty(existing.id, existing, cols, rows);
        }
        return;
      }

      const tabId = openTab({
        id: session.id,
        kind: "omp",
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
      });

      // Null means MAX_TABS reached — silently do nothing (TabBar shows hint)
      if (!tabId) return;

      await spawnPty(
        tabId,
        { kind: "omp", sessionId: session.id, cwd: session.cwd },
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
    async (session: OmpSession, cols: number, rows: number) => {
      if (refreshingSessionIds.has(session.id)) return;
      refreshingSessionIds.add(session.id);

      try {
        const existing = useTerminalStore
          .getState()
          .tabs.find((tab) => tab.sessionId === session.id);

        // Preserve the existing tab's ID so sidebarOrder stays stable.
        // For a new session, the original tab.id was a frontend UUID;
        // using session.id here would orphan it in sidebarOrder.
        const tabId = existing?.id ?? session.id;

        if (existing) await closeTab(existing.id);

        const newTabId = openTab({
          id: tabId,
          kind: "omp",
          sessionId: session.id,
          title: session.title,
          cwd: session.cwd,
        });
        if (!newTabId) return;

        await spawnPty(
          newTabId,
          { kind: "omp", sessionId: session.id, cwd: session.cwd },
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
