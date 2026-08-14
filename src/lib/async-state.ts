/**
 * @module lib/async-state
 * Generic discriminated union for async data states.
 *
 * Every data-fetching component uses this type so state handling
 * is exhaustive and consistent across the app.
 *
 * States:
 * - `initial`  — component mounted, no fetch triggered yet
 * - `loading`  — fetch in flight
 * - `error`    — fetch failed (holds the error message)
 * - `empty`    — fetch succeeded, zero results
 * - `data`     — fetch succeeded, results available
 *
 * @example
 * const [state, setState] = useState<AsyncState<OmpSession[]>>({ type: "initial" });
 *
 * // In render:
 * if (state.type === "loading") return <Spinner />;
 * if (state.type === "error")   return <ErrorBanner message={state.message} />;
 * if (state.type === "empty")   return <EmptyState />;
 * if (state.type === "data")    return <List items={state.data} />;
 */

/** Component has mounted but no fetch has been triggered yet. */
export interface InitialState {
  type: "initial";
}

/** A fetch is currently in flight. */
export interface LoadingState {
  type: "loading";
}

/** The last fetch failed. */
export interface ErrorState {
  type: "error";
  message: string;
}

/** Fetch succeeded but the result set is empty. */
export interface EmptyState {
  type: "empty";
}

/** Fetch succeeded and data is available. */
export interface DataState<T> {
  type: "data";
  data: T;
}

/** Discriminated union of all async states for a value of type `T`. */
export type AsyncState<T> =
  InitialState | LoadingState | ErrorState | EmptyState | DataState<T>;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Derive an `AsyncState` from a loading flag, error, and result array. */
export function deriveState<T>(
  isLoading: boolean,
  error: string | null,
  items: T[],
  hasLoadedOnce: boolean
): AsyncState<T[]> {
  if (!hasLoadedOnce && isLoading) return { type: "loading" };
  if (isLoading) return { type: "loading" };
  if (error) return { type: "error", message: error };
  if (!hasLoadedOnce) return { type: "initial" };
  if (items.length === 0) return { type: "empty" };
  return { type: "data", data: items };
}
