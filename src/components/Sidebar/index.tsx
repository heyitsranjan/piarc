/**
 * @module components/Sidebar
 * Session browser — handles all five async states explicitly:
 *
 * - initial  → first-launch hint (omp not yet used / cold start)
 * - loading  → spinner skeleton rows
 * - error    → error banner with retry
 * - empty    → "no sessions found" with path hint
 * - data     → scrollable session list
 *
 * Registers ⌘K (palette), ⌘R (refresh), ⌘B (toggle sidebar) globally.
 */
import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";
import type { OmpSession } from "@/lib/session";
import { useUiStore } from "@/store/ui";

import SearchBar from "./SearchBar";
import SessionRow from "./SessionRow";
import SidebarHeader from "./SidebarHeader";

export default function Sidebar() {
  const { state, filtered, activeSession, loadSessions } = useSessions();
  const { openSession } = useTerminal();
  const openCmdPalette = useUiStore((s) => s.openCommandPalette);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useKeyboard([
    { key: "k", meta: true, handler: openCmdPalette },
    { key: "r", meta: true, handler: () => loadSessions() },
    { key: "b", meta: true, handler: toggleSidebar },
  ]);

  const handleSelect = async (session: OmpSession) => {
    await openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-elev)]">
      <SidebarHeader />

      <div className="px-2 pb-2 shrink-0">
        <SearchBar />
      </div>

      {/* ── State machine ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {state.type === "initial" && <InitialHint />}
        {state.type === "loading" && <LoadingSkeleton />}
        {state.type === "error" && (
          <ErrorBanner message={state.message} onRetry={loadSessions} />
        )}
        {state.type === "empty" && <EmptyList />}
        {state.type === "data" && (
          <ul role="list" className="py-1">
            {filtered.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isActive={activeSession?.id === session.id}
                onSelect={() => handleSelect(session)}
              />
            ))}
            {filtered.length === 0 && <NoSearchResults />}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── State views ──────────────────────────────────────────────────────────

/** Shown before the first fetch — cold launch, omp never used on this machine. */
function InitialHint() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
      <span className="text-2xl">π</span>
      <p className="text-xs text-[var(--color-ink-5)]">Starting up…</p>
    </div>
  );
}

/** Pulsing skeleton rows while the Rust backend scans the session directory. */
function LoadingSkeleton() {
  return (
    <ul className="py-2 px-2 space-y-1" aria-busy aria-label="Loading sessions">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-[var(--radius-sm)] px-3 py-2 space-y-1.5"
        >
          <div
            className="h-2.5 rounded bg-[var(--color-bg-2)]"
            style={{ width: `${65 + (i % 3) * 12}%` }}
          />
          <div className="h-2 rounded bg-[var(--color-bg-2)] w-2/5" />
        </li>
      ))}
    </ul>
  );
}

/** Shown when the fetch fails — displays the error and a retry button. */
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-2 mt-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
      <p className="text-xs text-[var(--color-danger)] font-medium mb-1">
        Failed to load sessions
      </p>
      <p className="text-[10px] text-[var(--color-ink-5)] mb-2 break-all">{message}</p>
      <button
        onClick={onRetry}
        className="text-[10px] text-[var(--color-accent)] hover:underline"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Shown when the sessions directory exists but contains no JSONL files.
 * Gives the user a path hint so they know where sessions are stored.
 */
function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
      <p className="text-xs text-[var(--color-ink-5)]">No sessions yet</p>
      <p className="text-[10px] text-[var(--color-ink-9)] font-mono break-all">
        ~/.omp/agent/sessions/
      </p>
      <p className="text-[10px] text-[var(--color-ink-7)]">
        Run <code className="font-mono text-[var(--color-accent)]">omp</code> to create
        one
      </p>
    </div>
  );
}

/** Shown when data is available but the current search query has no matches. */
function NoSearchResults() {
  return (
    <li className="flex flex-col items-center justify-center h-24 gap-1">
      <p className="text-xs text-[var(--color-ink-5)]">No matches</p>
      <p className="text-[10px] text-[var(--color-ink-7)]">Try a different search term</p>
    </li>
  );
}
