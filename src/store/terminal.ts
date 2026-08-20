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
import { killPty } from "@/lib/ipc";
import { shortId } from "@/lib/utils";

/** Tab kinds: terminal sessions, plain shells, or plain-text notes. */
export type TabKind = "omp" | "terminal" | "note";

export interface Tab {
  /** Unique tab ID — also the PTY cache key in Rust `AppState`. */
  id: string;
  /** omp session UUID being resumed in this tab, or synthetic note ID. */
  sessionId: string;
  /** Whether this tab runs omp, a plain login shell, or a note. */
  kind: TabKind;
  /** Human-readable label shown in the tab strip. */
  title: string;
  /** Working directory; passed to `createPty`. Notes leave this empty. */
  cwd: string;
  /** Creation timestamp used by the sidebar's relative time label. */
  createdAt: number;
  /** Whether this tab floats to the top of its section. */
  isPinned: boolean;
  /**
   * True when the user manually renamed this tab.
   * Prevents automatic title sync from session data reloads.
   */
  userRenamed: boolean;
  /** Semantic OMP lifecycle state emitted by the bundled status extension. */
  activity: AgentActivity;
  /** True while the PTY is still spawning. */
  isLoading: boolean;
  /** Non-null when the PTY failed to spawn. */
  error: string | null;
  /** Plain-text content for note tabs. */
  content: string;
  /**
   * True when the terminal shell is at a prompt (no command running).
   * Notes are always idle.
   */
  isIdle: boolean;
  /** User-written note attached to any tab. */
  note: string;
}

interface TerminalState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Tab temporarily accepting direct keyboard input for an OMP terminal UI. */
  interactiveTabId: string | null;

  /**
   * Open a new terminal tab. Always succeeds — the Rust PTY cache (LRU,
   * cap 12) evicts the least-recently-used process when full, and the
   * evicted tab's reader thread emits `pty_exit` so the frontend marks it
   * disconnected for reconnection on click.
   */
  openTab: (
    session: Pick<Tab, "sessionId" | "title" | "cwd" | "kind"> & { id?: string }
  ) => string;

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
  /** Replace a temporary new-session identifier with the ID reported by OMP.
   * If `title` is provided and the tab hasn't been user-renamed, also updates
   * the tab title to match the resolved session title. */
  bindTabSession: (tabId: string, sessionId: string, title?: string) => void;

  /** Mark a tab's PTY as ready (loading = false, error = null). */
  setTabReady: (tabId: string) => void;

  /**
   * Record a PTY spawn failure for `tabId`.
   * Sets `isLoading = false` and `error = message`.
   */
  setTabError: (tabId: string, message: string) => void;

  /** Update the tab's display title and mark it as user-renamed. */
  updateTabTitle: (tabId: string, title: string) => void;
  /**
   * Sync a tab title from session data — skipped when the user renamed it.
   * Called from sessions store after `loadSessions` resolves.
   */
  syncTabTitle: (tabId: string, title: string) => void;
  /** Toggle whether a terminal floats to the top of the sidebar section. */
  toggleTabPin: (tabId: string) => void;

  /** Retry: reset a failed tab back to loading so the caller can re-spawn. */
  retryTab: (tabId: string) => void;
  /** Apply a structured lifecycle update emitted by the OMP status extension. */
  setTabActivity: (tabId: string, activity: AgentActivity) => void;
  /** Update persisted plain-text content for a note tab. */
  updateTabContent: (tabId: string, content: string) => void;
  /** Update the user-written note attached to a tab. */
  updateTabNote: (tabId: string, note: string) => void;
  /** Mark a terminal tab as idle (prompt visible) or busy. */
  setTabIdle: (tabId: string, isIdle: boolean) => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      interactiveTabId: null,

      openTab: (session) => {
        const id = session.id ?? `tab-${shortId()}`;
        const tab: Tab = {
          id,
          isLoading: session.kind === "note" ? false : true,
          error: null,
          activity: { state: session.kind === "note" ? "waiting_input" : "starting" },
          createdAt: Date.now() / 1000,
          isPinned: false,
          userRenamed: false,
          kind: session.kind,
          sessionId: session.sessionId,
          note: "",
          title: session.title,
          cwd: session.cwd,
          content: "",
          isIdle: true,
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
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, title, userRenamed: true } : t
          ),
        })),

      syncTabTitle: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && !t.userRenamed ? { ...t, title } : t
          ),
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

      bindTabSession: (tabId, sessionId, title) =>
        set((s) => ({
          tabs: s.tabs.map((tab) =>
            tab.id === tabId && tab.kind === "omp"
              ? {
                  ...tab,
                  sessionId,
                  // Only update title if the user hasn't renamed this tab
                  ...(title && !tab.userRenamed ? { title } : {}),
                }
              : tab
          ),
        })),

      setTabActivity: (tabId, activity) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, activity } : t)),
        })),
      updateTabContent: (tabId, content) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, content } : t)),
        })),
      updateTabNote: (tabId, note) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, note } : t)),
        })),
      setTabIdle: (tabId, isIdle) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId && t.kind !== "note" ? { ...t, isIdle } : t
          ),
        })),
    }),
    {
      name: "piarc-terminal-tabs",
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          isLoading: false,
          isIdle: true,
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
            note: tab.note ?? "",
            isIdle: true,
            activity: { state: "disconnected" },
          })),
          activeTabId: null,
          interactiveTabId: null,
        };
      },
    }
  )
);
