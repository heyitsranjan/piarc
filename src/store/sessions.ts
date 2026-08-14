/**
 * @module store/sessions
 * Zustand slice for omp session list.
 *
 * Tracks `hasLoadedOnce` so consumers can distinguish `initial` (never
 * fetched) from `empty` (fetched, zero results) — both needed for correct UI.
 *
 * Persists only UI preferences (pinned IDs) to localStorage.
 * Session data is always re-fetched live from the Rust backend.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { deleteSession, listSessions } from "@/lib/ipc";
import type { OmpSession } from "@/lib/session";

interface SessionsState {
  /** Full list of sessions, sorted newest-first by the Rust backend. */
  sessions: OmpSession[];
  /** The session whose terminal is currently shown in the main pane. */
  activeSession: OmpSession | null;
  /** Current search/filter query. */
  searchQuery: string;
  /** Session IDs pinned by the user; pinned sessions float to the top. */
  pinnedIds: string[];
  /** True while `loadSessions` is in flight. */
  isLoading: boolean;
  /** True once at least one successful fetch has completed. */
  hasLoadedOnce: boolean;
  /** Error message from the most recent failed fetch, or null. */
  error: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Fetch sessions from the Rust backend and update `sessions`. */
  loadSessions: () => Promise<void>;
  /** Set the active session (shown in the terminal area). */
  setActive: (session: OmpSession) => void;
  /** Update the filter query used by `filtered()`. */
  setSearch: (q: string) => void;
  /** Toggle pin state for a session by ID. */
  togglePin: (id: string) => void;
  /** Delete session file from disk and remove it from the store. */
  removeSession: (path: string) => Promise<void>;

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Returns the filtered + pinned-first session list.
   * Pinned sessions always float to the top regardless of recency.
   */
  filtered: () => OmpSession[];
}

export const useSessionStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSession: null,
      searchQuery: "",
      pinnedIds: [],
      isLoading: false,
      hasLoadedOnce: false,
      error: null,

      loadSessions: async () => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await listSessions();
          set({ sessions, isLoading: false, hasLoadedOnce: true });
        } catch (err) {
          set({ error: String(err), isLoading: false, hasLoadedOnce: true });
        }
      },

      setActive: (session) => set({ activeSession: session }),

      setSearch: (searchQuery) => set({ searchQuery }),

      togglePin: (id) =>
        set((s) => ({
          pinnedIds: s.pinnedIds.includes(id)
            ? s.pinnedIds.filter((p) => p !== id)
            : [...s.pinnedIds, id],
        })),

      removeSession: async (path) => {
        await deleteSession(path);
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.path !== path),
          activeSession: s.activeSession?.path === path ? null : s.activeSession,
        }));
      },

      filtered: () => {
        const { sessions, searchQuery, pinnedIds } = get();
        const q = searchQuery.toLowerCase().trim();
        const matches = q
          ? sessions.filter(
              (s) =>
                s.title.toLowerCase().includes(q) ||
                s.cwd.toLowerCase().includes(q) ||
                s.firstMessage.toLowerCase().includes(q)
            )
          : sessions;
        const pinned = matches.filter((s) => pinnedIds.includes(s.id));
        const rest = matches.filter((s) => !pinnedIds.includes(s.id));
        return [...pinned, ...rest];
      },
    }),
    {
      name: "omp-ui-prefs",
      // Only persist UI choices — session data comes from disk on every launch
      partialize: (s) => ({ pinnedIds: s.pinnedIds }),
    }
  )
);
