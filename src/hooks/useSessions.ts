/**
 * @module hooks/useSessions
 * Convenience hook that resolves session store state into a typed `AsyncState`.
 *
 * Converts the raw `isLoading / error / hasLoadedOnce / sessions` flags into
 * the `AsyncState<OmpSession[]>` discriminated union so every consumer gets
 * exhaustive state handling for free.
 */
import { useSessionStore } from "@/store/sessions";

import { type AsyncState, deriveState } from "@/lib/async-state";
import type { OmpSession } from "@/lib/session";

export interface UseSessionsReturn {
  /** Typed async state — covers initial / loading / error / empty / data. */
  state: AsyncState<OmpSession[]>;
  /** All sessions, unfiltered (raw list from Rust). */
  sessions: OmpSession[];
  /** Filtered + pinned-first list derived from current search query. */
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
  return {
    state: deriveState(store.isLoading, store.error, store.sessions, store.hasLoadedOnce),
    sessions: store.sessions,
    filtered: store.filtered(),
    activeSession: store.activeSession,
    searchQuery: store.searchQuery,
    pinnedIds: store.pinnedIds,
    loadSessions: store.loadSessions,
    setSearch: store.setSearch,
    togglePin: store.togglePin,
    removeSession: store.removeSession,
  };
}
