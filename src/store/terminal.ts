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
  /**
   * True while PTY bytes are actively flowing (omp is thinking/running).
   * Set by TerminalTab on each output chunk; cleared after 500ms of silence.
   * Used by SessionRow to show spinner vs idle green dot.
   */
  isOutputting: boolean;
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
  /** Set output-activity flag; called from TerminalTab on each PTY chunk. */
  setTabOutputting: (tabId: string, outputting: boolean) => void;
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
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
      isOutputting: false,
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
      const activeTabId =
        s.activeTabId === tabId ? (tabs.at(-1)?.id ?? null) : s.activeTabId;
      const interactiveTabId = s.interactiveTabId === tabId ? null : s.interactiveTabId;
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
        t.id === tabId ? { ...t, isLoading: false, error: null } : t
      ),
    })),

  setTabError: (tabId, message) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isLoading: false, error: message } : t
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
        t.id === tabId ? { ...t, isLoading: true, error: null } : t
      ),
    })),

  setTabOutputting: (tabId, isOutputting) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isOutputting } : t)),
    })),
}));
