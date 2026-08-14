import type { ReactNode } from "react";
/**
 * @module components/CommandPalette
 * ⌘K overlay — search and open any session. Handles all async states.
 */
import { useCallback, useEffect, useState } from "react";

import { TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS } from "@/components/Terminal/constants";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";
import { cwdShort,timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";

export default function CommandPalette() {
  const { state, sessions, loadSessions } = useSessions();
  const { openSession } = useTerminal();
  const close = useUiStore((s) => s.closeCommandPalette);

  const [query,       setQuery]    = useState("");
  const [selectedIdx, setSelected] = useState(0);

  const q = query.toLowerCase().trim();
  const results = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.cwd.toLowerCase().includes(q) ||
          s.firstMessage.toLowerCase().includes(q)
      )
    : sessions;

  useEffect(() => { setSelected(0); }, [query]);

  const confirm = useCallback(async () => {
    const session = results[selectedIdx];
    if (!session) return;
    await openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
    close();
  }, [results, selectedIdx, openSession, close]);

  useKeyboard([
    { key: "Escape",    handler: close },
    { key: "ArrowUp",   handler: () => setSelected((i) => Math.max(0, i - 1)) },
    { key: "ArrowDown", handler: () => setSelected((i) => Math.min(results.length - 1, i + 1)) },
    { key: "Enter",     handler: confirm },
  ]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] palette-backdrop"
        onClick={close}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal
        className="fixed z-50 top-[16%] left-1/2 -translate-x-1/2
          w-full max-w-lg palette-panel
          bg-[var(--color-bg-2)] border border-[var(--color-border)]
          rounded-[var(--radius-lg)]
          shadow-[0_24px_64px_rgba(0,0,0,0.65)]
          overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border)]"
          style={{ height: 48 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
            stroke="var(--color-ink-7)" strokeWidth="1.8" strokeLinecap="round"
            className="shrink-0">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="m10 10 3 3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            autoFocus
            className="flex-1 text-[13px] bg-transparent text-[var(--color-ink-0)]
              placeholder:text-[var(--color-ink-9)] outline-none"
          />
          <kbd className="text-[10px] text-[var(--color-ink-9)] shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {state.type === "initial" && (
            <StatusRow>Starting…</StatusRow>
          )}
          {state.type === "loading" && (
            <StatusRow>
              <span className="inline-flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  className="animate-spin shrink-0">
                  <circle cx="8" cy="8" r="6" strokeOpacity="0.2"/>
                  <path d="M14 8a6 6 0 0 0-6-6"/>
                </svg>
                Loading…
              </span>
            </StatusRow>
          )}
          {state.type === "error" && (
            <div className="px-4 py-5 text-center space-y-2">
              <p className="text-[12px] text-[var(--color-danger)]">Failed to load</p>
              <button onClick={loadSessions}
                className="text-[11px] text-[var(--color-accent)] hover:underline">
                Retry
              </button>
            </div>
          )}
          {state.type === "empty" && (
            <StatusRow>No sessions yet — run <code className="font-mono text-[var(--color-accent)]">omp</code></StatusRow>
          )}
          {state.type === "data" && (
            <ul role="listbox">
              {results.length === 0 ? (
                <StatusRow>No results for "{query}"</StatusRow>
              ) : results.map((session, idx) => (
                <li
                  key={session.id}
                  role="option"
                  aria-selected={idx === selectedIdx}
                  onClick={confirm}
                  onMouseEnter={() => setSelected(idx)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 h-11 cursor-pointer",
                    "transition-colors duration-[var(--duration-fast)]",
                    idx === selectedIdx
                      ? "bg-[var(--color-bg-active)]"
                      : "hover:bg-[var(--color-bg-hover)]"
                  )}
                >
                  <div className="flex flex-col justify-center min-w-0 gap-0.5">
                    <span className="text-[13px] text-[var(--color-ink-0)] truncate font-medium">
                      {session.title}
                    </span>
                    <span className="text-[10.5px] text-[var(--color-ink-9)] font-mono truncate">
                      {cwdShort(session.cwd)}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[var(--color-ink-9)] shrink-0 tabular-nums">
                    {timeAgo(session.modified)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 h-8
          border-t border-[var(--color-border)] text-[10px] text-[var(--color-ink-9)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  );
}

function StatusRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center h-16 text-[12px] text-[var(--color-ink-7)]">
      {children}
    </div>
  );
}
