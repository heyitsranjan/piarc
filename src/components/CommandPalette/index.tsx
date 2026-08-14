import type { ReactNode } from "react";
/**
 * @module components/CommandPalette
 * ⌘K overlay — search and open any omp session in a new terminal tab.
 *
 * States handled:
 * - initial  → shows full unfiltered session list (quick-pick)
 * - loading  → shows spinner while sessions are being fetched
 * - error    → shows error with retry
 * - empty    → "no sessions yet" with omp usage hint
 * - data     → filtered list; sub-state "no search results" when query has no matches
 *
 * Keyboard: ↑↓ navigate · ↵ open · Esc close
 */
import { useCallback, useEffect, useState } from "react";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";
import { useUiStore } from "@/store/ui";

import PaletteInput from "./PaletteInput";
import PaletteItem from "./PaletteItem";

export default function CommandPalette() {
  const { state, sessions, loadSessions } = useSessions();
  const { openSession } = useTerminal();
  const close = useUiStore((s) => s.closeCommandPalette);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelected] = useState(0);

  // Filtered results from in-memory session list
  const q = query.toLowerCase().trim();
  const results = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.cwd.toLowerCase().includes(q) ||
          s.firstMessage.toLowerCase().includes(q)
      )
    : sessions;

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const confirm = useCallback(async () => {
    const session = results[selectedIdx];
    if (!session) return;
    await openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
    close();
  }, [results, selectedIdx, openSession, close]);

  useKeyboard([
    { key: "Escape", handler: close },
    { key: "ArrowUp", handler: () => setSelected((i) => Math.max(0, i - 1)) },
    {
      key: "ArrowDown",
      handler: () => setSelected((i) => Math.min(results.length - 1, i + 1)),
    },
    { key: "Enter", handler: confirm },
  ]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal
        className="fixed z-50 top-[18%] left-1/2 -translate-x-1/2 w-full max-w-lg
          bg-[var(--color-bg-elev)] border border-[var(--color-border)]
          rounded-[var(--radius-lg)] shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="border-b border-[var(--color-border-2)]">
          <PaletteInput value={query} onChange={setQuery} />
        </div>

        {/* ── Result state machine ─────────────────────────────────────── */}
        <div className="max-h-80 overflow-y-auto">
          {state.type === "initial" && <StatusMessage>Starting up…</StatusMessage>}

          {state.type === "loading" && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--color-ink-5)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="animate-spin"
              >
                <circle cx="8" cy="8" r="6" strokeOpacity="0.2" />
                <path d="M14 8a6 6 0 0 0-6-6" />
              </svg>
              Loading sessions…
            </div>
          )}

          {state.type === "error" && (
            <div className="px-4 py-6 text-center space-y-2">
              <p className="text-xs text-[var(--color-danger)]">
                Failed to load sessions
              </p>
              <p className="text-[10px] text-[var(--color-ink-7)]">{state.message}</p>
              <button
                onClick={loadSessions}
                className="text-[10px] text-[var(--color-accent)] hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {state.type === "empty" && (
            <div className="px-4 py-8 text-center space-y-1">
              <p className="text-xs text-[var(--color-ink-5)]">No sessions yet</p>
              <p className="text-[10px] text-[var(--color-ink-7)]">
                Run <code className="text-[var(--color-accent)]">omp</code> to create your
                first session
              </p>
            </div>
          )}

          {state.type === "data" && (
            <ul role="listbox" aria-label="Sessions">
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-[var(--color-ink-7)]">
                  No sessions match "
                  <span className="text-[var(--color-ink-1)]">{query}</span>"
                </li>
              ) : (
                results.map((session, idx) => (
                  <PaletteItem
                    key={session.id}
                    session={session}
                    isSelected={idx === selectedIdx}
                    onSelect={confirm}
                  />
                ))
              )}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-2)] px-4 py-2 flex gap-4 text-[10px] text-[var(--color-ink-7)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  );
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-[var(--color-ink-5)]">
      {children}
    </div>
  );
}
