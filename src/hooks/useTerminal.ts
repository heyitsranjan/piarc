/**
 * @module hooks/useTerminal
 * High-level terminal tab operations.
 *
 * Handles all lifecycle transitions for a tab:
 * - opening → loading → ready (PTY live)
 * - opening → loading → error (PTY spawn failed)
 * - retry   → loading → ready | error
 *
 * Components call these instead of wiring store + IPC manually.
 */
import { useCallback } from "react";

import { createPty } from "@/lib/ipc";
import type { OmpSession } from "@/lib/session";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

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
  const setActive = useSessionStore((s) => s.setActive);

  /** Internal: spawn PTY for an already-opened tab. */
  const spawnPty = useCallback(
    async (tabId: string, session: OmpSession, cols: number, rows: number) => {
      try {
        await createPty({
          tabId,
          sessionId: session.id,
          cwd: session.cwd,
          cols,
          rows,
        });
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
      setActive(session);

      // Reuse an existing tab for this session rather than opening a duplicate
      const existing = tabs.find((t) => t.sessionId === session.id);
      if (existing) {
        setActiveTab(existing.id);
        return;
      }

      const tabId = openTab({
        sessionId: session.id,
        title: session.title,
        cwd: session.cwd,
      });

      // Null means MAX_TABS reached — silently do nothing (TabBar shows hint)
      if (!tabId) return;

      await spawnPty(tabId, session, cols, rows);
    },
    [tabs, openTab, setActiveTab, setActive, spawnPty]
  );

  const retryTab = useCallback(
    async (tabId: string, cols: number, rows: number) => {
      const tab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      markRetry(tabId); // isLoading = true, error = null
      const session: OmpSession = {
        id: tab.sessionId,
        path: "",
        title: tab.title,
        cwd: tab.cwd,
        modified: 0,
        firstMessage: "",
      };
      await spawnPty(tabId, session, cols, rows);
    },
    [markRetry, spawnPty]
  );

  return { openSession, closeTab, switchTab: setActiveTab, retryTab };
}
