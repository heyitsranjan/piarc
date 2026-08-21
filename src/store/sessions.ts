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

import { useTerminalStore } from "@/store/terminal";

import { fuzzyMatchAny } from "@/lib/fuzzy";
import { deleteSession, listSessions, renameSession } from "@/lib/ipc";
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
  /** User-defined title overrides by session ID. Survives session data reloads. */
  renamedTitles: Record<string, string>;
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
  setActive: (session: OmpSession | null) => void;
  /** Update the filter query used by `filtered()`. */
  setSearch: (q: string) => void;
  /** Toggle pin state for a session by ID. */
  togglePin: (id: string) => void;
  /** Delete session file from disk and remove it from the store. */
  removeSession: (path: string) => Promise<void>;
  /**
   * Rename a session — optimistically updates the store, then writes
   * the new title to the JSONL title slot via the Rust backend.
   */
  renameSession: (path: string, title: string) => Promise<void>;

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
      renamedTitles: {},
      isLoading: false,
      hasLoadedOnce: false,
      error: null,

      loadSessions: async () => {
        set({ isLoading: true, error: null });
        try {
          const fetched = await listSessions();
          const { renamedTitles } = get();
          const sessions = fetched.map((s) =>
            renamedTitles[s.id] ? { ...s, title: renamedTitles[s.id] } : s
          );
          set({ sessions, isLoading: false, hasLoadedOnce: true });

          // Sync metadata onto existing tabs. DB (localStorage) is the source of truth
          // for tabs — new sessions on disk do NOT create tabs here. Tabs are only
          // created when the user opens a session (openSession) or via the terminal store.
          const { tabs, syncTabFromSession } = useTerminalStore.getState();
          const tabsBySessionId = new Map(
            tabs.filter((t) => t.agent === "omp").map((t) => [t.sessionId, t])
          );
          for (const s of sessions) {
            const existing = tabsBySessionId.get(s.id);
            if (existing) {
              syncTabFromSession(existing.id, {
                title: s.title,
                cwd: s.cwd,
                path: s.path,
                firstMessage: s.firstMessage,
                modifiedAt: s.modified,
              });
            }
          }
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
        set((s) => {
          const removed = s.sessions.find((session) => session.path === path);
          return {
            sessions: s.sessions.filter((session) => session.path !== path),
            activeSession: s.activeSession?.path === path ? null : s.activeSession,
            pinnedIds: removed
              ? s.pinnedIds.filter((id) => id !== removed.id)
              : s.pinnedIds,
            renamedTitles: removed
              ? Object.fromEntries(
                  Object.entries(s.renamedTitles).filter(([id]) => id !== removed.id)
                )
              : s.renamedTitles,
          };
        });
      },

      renameSession: async (path, title) => {
        // Find the session to get its ID for renamedTitles and tab sync.
        const session = get().sessions.find((s) => s.path === path);
        const sessionId = session?.id;

        // Optimistic update — UI reflects change immediately
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.path === path ? { ...sess, title } : sess
          ),
          activeSession:
            s.activeSession?.path === path
              ? { ...s.activeSession, title }
              : s.activeSession,
          // Persist the override so future loadSessions() calls don't clobber it.
          renamedTitles: sessionId
            ? { ...s.renamedTitles, [sessionId]: title }
            : s.renamedTitles,
        }));

        // Sync the terminal tab title for this session.
        // Uses syncTabTitle (not updateTabTitle) so a tab the user renamed
        // directly via the terminal context menu is not clobbered.
        if (sessionId) {
          const { tabs, syncTabTitle } = useTerminalStore.getState();
          const tab = tabs.find((t) => t.sessionId === sessionId);
          if (tab) syncTabTitle(tab.id, title);
        }

        // Persist to disk — rewrites JSONL title slot
        await renameSession(path, title);
      },

      filtered: () => {
        const { sessions, searchQuery, pinnedIds } = get();
        const q = searchQuery.toLowerCase().trim();
        const matches = q
          ? sessions.filter((s) => fuzzyMatchAny(q, s.title, s.cwd, s.firstMessage))
          : sessions;
        const pinned = matches.filter((s) => pinnedIds.includes(s.id));
        const rest = matches.filter((s) => !pinnedIds.includes(s.id));
        return [...pinned, ...rest];
      },
    }),
    {
      name: "omp-ui-prefs",
      // Only persist UI choices — session data comes from disk on every launch
      partialize: (s) => ({ pinnedIds: s.pinnedIds, renamedTitles: s.renamedTitles }),
    }
  )
);
