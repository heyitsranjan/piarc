/**
 * @module store/terminal
 * Zustand slice for terminal tab state.
 *
 * Every tab tracks its own lifecycle state:
 * - `isLoading` — PTY is being spawned
 * - `error`     — PTY spawn failed (non-null string = error message)
 * - neither     — PTY is live and interactive
 *
 * Closing a tab kills its PTY via `killPty` IPC.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AgentActivity } from "@/lib/agent-activity";
import { MAX_TABS } from "@/lib/constants";
import { killPty } from "@/lib/ipc";
import { shortId } from "@/lib/utils";

/** A single terminal tab and its lifecycle state. */
export type TabKind = "omp" | "terminal";

export interface Tab {
  /** Unique tab ID — also the PTY cache key in Rust `AppState`. */
  id: string;
  /** omp session UUID being resumed in this tab. */
  sessionId: string;
  /** Whether this tab runs omp or a plain login shell. */
  kind: TabKind;
  /** Human-readable label shown in the tab strip. */
  title: string;
  /** Working directory; passed to `createPty`. */
  cwd: string;
  /** Creation timestamp used by the sidebar's relative time label. */
  createdAt: number;
  /** Whether this terminal floats to the top of the terminal section. */
  isPinned: boolean;
  /**
   * True while the PTY process is being spawned.
   * Cleared to false on success or error.
   */
  isLoading: boolean;
  /**
   * Non-null when the PTY failed to spawn.
   * Contains a human-readable error message from the Rust backend.
   * null means no error (either loading or live).
   */
  error: string | null;
  /** Semantic OMP lifecycle state emitted by the bundled status extension. */
  activity: AgentActivity;
}

interface TerminalState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Tab temporarily accepting direct keyboard input for an OMP terminal UI. */
  interactiveTabId: string | null;

  /**
   * Open a new terminal tab.
   * Returns the new tab's ID, or null if MAX_TABS is reached.
   */
  openTab: (session: Pick<Tab, "sessionId" | "title" | "cwd" | "kind">) => string | null;

  /**
   * Kill the PTY and remove the tab.
   * Falls back gracefully if the PTY is already dead.
   */
  closeTab: (tabId: string) => Promise<void>;

  /** Switch the visible terminal to `tabId`. */
  setActiveTab: (tabId: string) => void;
  /** Enable direct xterm input while an OMP command owns an interactive terminal UI. */
  enableTerminalInteraction: (tabId: string) => void;
  /** Return xterm to passive output-only mode. */
  disableTerminalInteraction: (tabId: string) => void;
  /** Replace a temporary new-session identifier with the ID reported by OMP. */
  bindTabSession: (tabId: string, sessionId: string) => void;

  /** Mark a tab's PTY as ready (loading = false, error = null). */
  setTabReady: (tabId: string) => void;

  /**
   * Record a PTY spawn failure for `tabId`.
   * Sets `isLoading = false` and `error = message`.
   */
  setTabError: (tabId: string, message: string) => void;

  /** Update the tab's display title (e.g. from omp session rename). */
  updateTabTitle: (tabId: string, title: string) => void;
  /** Toggle whether a terminal floats to the top of the sidebar section. */
  toggleTabPin: (tabId: string) => void;

  /** Retry: reset a failed tab back to loading so the caller can re-spawn. */
  retryTab: (tabId: string) => void;
  /** Apply a structured lifecycle update emitted by the OMP status extension. */
  setTabActivity: (tabId: string, activity: AgentActivity) => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      interactiveTabId: null,

      openTab: (session) => {
        if (get().tabs.length >= MAX_TABS) return null;
        const id = `tab-${shortId()}`;
        const tab: Tab = {
          id,
          isLoading: true,
          error: null,
          activity: { state: "starting" },
          createdAt: Date.now() / 1000,
          isPinned: false,
          ...session,
        };
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
        return id;
      },

      closeTab: async (tabId) => {
        try {
          await killPty(tabId);
        } catch {
          // PTY may already be dead — not fatal
        }
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== tabId);
          const activeTabId = s.activeTabId === tabId ? null : s.activeTabId;
          const interactiveTabId =
            s.interactiveTabId === tabId ? null : s.interactiveTabId;
          return { tabs, activeTabId, interactiveTabId };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId, interactiveTabId: null }),

      enableTerminalInteraction: (tabId) => set({ interactiveTabId: tabId }),

      disableTerminalInteraction: (tabId) =>
        set((s) => ({
          interactiveTabId: s.interactiveTabId === tabId ? null : s.interactiveTabId,
        })),

      setTabReady: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  isLoading: false,
                  error: null,
                  activity: { state: "waiting_input" },
                }
              : t
          ),
        })),

      setTabError: (tabId, message) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, isLoading: false, error: message, activity: { state: "error" } }
              : t
          ),
        })),

      updateTabTitle: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
        })),

      toggleTabPin: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
        })),

      retryTab: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? { ...t, isLoading: true, error: null, activity: { state: "starting" } }
              : t
          ),
        })),

      bindTabSession: (tabId, sessionId) =>
        set((s) => ({
          tabs: s.tabs.map((tab) =>
            tab.id === tabId && tab.kind === "omp" ? { ...tab, sessionId } : tab
          ),
        })),

      setTabActivity: (tabId, activity) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, activity } : t)),
        })),
    }),
    {
      name: "piarc-terminal-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          isLoading: false,
          activity: { state: "disconnected" },
          error: "Disconnected — select to reconnect",
        })),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<TerminalState>;
        return {
          ...current,
          ...saved,
          tabs: (saved.tabs ?? []).map((tab) => ({
            ...tab,
            activity: { state: "disconnected" },
          })),
          activeTabId: null,
          interactiveTabId: null,
        };
      },
    }
  )
);
