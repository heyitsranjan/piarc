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
export interface Tab {
  /** Unique tab ID — also the PTY cache key in Rust `AppState`. */
  id: string;
  /** omp session UUID being resumed in this tab. */
  sessionId: string;
  /** Human-readable label shown in the tab strip. */
  title: string;
  /** Working directory; passed to `createPty`. */
  cwd: string;
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

  /**
   * Open a new terminal tab.
   * Returns the new tab's ID, or null if MAX_TABS is reached.
   */
  openTab: (session: Pick<Tab, "sessionId" | "title" | "cwd">) => string | null;

  /**
   * Kill the PTY and remove the tab.
   * Falls back gracefully if the PTY is already dead.
   */
  closeTab: (tabId: string) => Promise<void>;

  /** Switch the visible terminal to `tabId`. */
  setActiveTab: (tabId: string) => void;

  /** Mark a tab's PTY as ready (loading = false, error = null). */
  setTabReady: (tabId: string) => void;

  /**
   * Record a PTY spawn failure for `tabId`.
   * Sets `isLoading = false` and `error = message`.
   */
  setTabError: (tabId: string, message: string) => void;

  /** Update the tab's display title (e.g. from omp session rename). */
  updateTabTitle: (tabId: string, title: string) => void;

  /** Retry: reset a failed tab back to loading so the caller can re-spawn. */
  retryTab: (tabId: string) => void;
  /** Set output-activity flag; called from TerminalTab on each PTY chunk. */
  setTabOutputting: (tabId: string, outputting: boolean) => void;
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (session) => {
    if (get().tabs.length >= MAX_TABS) return null;
    const id = `tab-${shortId()}`;
    const tab: Tab = { id, isLoading: true, error: null, isOutputting: false, ...session };
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
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

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
