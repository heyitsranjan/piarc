/**
 * @module hooks/useSessions
 * Convenience hook that resolves session store state into a typed `AsyncState`.
 *
 * Converts the raw `isLoading / error / hasLoadedOnce / sessions` flags into
 * the `AsyncState<OmpSession[]>` discriminated union so every consumer gets
 * exhaustive state handling for free.
 *
 * ## Why `filtered` is computed here rather than via `store.filtered()`
 *
 * `store.filtered()` calls `get()` internally, which reads the **live** store
 * state. React's `useSyncExternalStore` snapshot guarantees only apply to the
 * values read directly from the snapshot object (`store.sessions`, etc.).
 * Calling `store.filtered()` therefore reads a different (potentially newer)
 * snapshot, which can make `sessions` and `filtered` diverge during rapid
 * `loadSessions` calls triggered by the FS watcher — causing duplicate React
 * keys in the sidebar.
 *
 * Computing `filtered` from the snapshot-captured `sessions` / `searchQuery` /
 * `pinnedIds` keeps everything in sync within a single render.
 */
import { useSessionStore } from "@/store/sessions";

import { type AsyncState, deriveState } from "@/lib/async-state";
import { fuzzyMatchAny } from "@/lib/fuzzy";
import type { OmpSession } from "@/lib/session";

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseSessionsReturn {
  /** Typed async state — covers initial / loading / error / empty / data. */
  state: AsyncState<OmpSession[]>;
  /** All sessions, unfiltered (raw list from Rust). */
  sessions: OmpSession[];
  /**
   * Filtered + pinned-first list derived from the snapshot `sessions`.
   * Always consistent with `sessions` — safe to use as React list keys.
   */
  filtered: OmpSession[];
  /** Currently active (visible) session. */
  activeSession: OmpSession | null;
  /** Current search query string. */
  searchQuery: string;
  /** IDs of pinned sessions. */
  pinnedIds: string[];

  loadSessions: () => Promise<void>;
  setSearch: (q: string) => void;
  togglePin: (id: string) => void;
  removeSession: (path: string) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access the session store with a fully-derived `AsyncState` for state-machine rendering.
 *
 * @example
 * const { state, filtered } = useSessions();
 *
 * switch (state.type) {
 *   case "initial":  return <FirstLaunchHint />;
 *   case "loading":  return <Spinner />;
 *   case "error":    return <ErrorBanner message={state.message} />;
 *   case "empty":    return <NoSessionsFound />;
 *   case "data":     return <SessionList sessions={filtered} />;
 * }
 */
export function useSessions(): UseSessionsReturn {
  const store = useSessionStore();
  const { sessions, searchQuery, pinnedIds } = store;

  // Compute filtered from the snapshot — avoids get() divergence (see module doc).
  const q = searchQuery.toLowerCase().trim();
  const matches = q
    ? sessions.filter((s) => fuzzyMatchAny(q, s.title, s.cwd, s.firstMessage))
    : sessions;
  const pinned = matches.filter((s) => pinnedIds.includes(s.id));
  const rest = matches.filter((s) => !pinnedIds.includes(s.id));
  const filtered = [...pinned, ...rest];

  return {
    state: deriveState(store.isLoading, store.error, sessions, store.hasLoadedOnce),
    sessions,
    filtered,
    activeSession: store.activeSession,
    searchQuery,
    pinnedIds,
    loadSessions: store.loadSessions,
    setSearch: store.setSearch,
    togglePin: store.togglePin,
    removeSession: store.removeSession,
  };
}
