/**
 * @module components/CommandPalette
 * ⌘K overlay — search and open any session. All async states handled.
 */
import { Loader2, Search, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

export default function CommandPalette() {
  const { state, sessions, loadSessions } = useSessions();
  const { openSession } = useTerminal();
  const close = useUiStore((s) => s.closeCommandPalette);
  const tabs = useTerminalStore((s) => s.tabs);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const setActiveSession = useSessionStore((s) => s.setActive);

  const [query, setQuery] = useState("");
  const [selectedIdx, setSelected] = useState(0);

  const q = query.toLowerCase().trim();
  const { sessionResults, terminalResults, results } = useMemo(() => {
    const matchedSessions = sessions.filter(
      (session) =>
        !q ||
        session.title.toLowerCase().includes(q) ||
        session.cwd.toLowerCase().includes(q) ||
        session.firstMessage.toLowerCase().includes(q)
    );
    const matchedTerminals = tabs
      .filter(
        (tab) =>
          tab.kind === "terminal" &&
          (!q || tab.title.toLowerCase().includes(q) || tab.cwd.toLowerCase().includes(q))
      )
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
    return {
      sessionResults: matchedSessions,
      terminalResults: matchedTerminals,
      results: [
        ...matchedSessions.map((session) => ({ kind: "session" as const, session })),
        ...matchedTerminals.map((tab) => ({ kind: "terminal" as const, tab })),
      ],
    };
  }, [sessions, tabs, q]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const confirm = useCallback(
    async (index = selectedIdx) => {
      const result = results[index];
      if (!result) return;
      if (result.kind === "session") {
        await openSession(result.session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
      } else {
        setActiveSession(null);
        setActiveTab(result.tab.id);
      }
      close();
    },
    [results, selectedIdx, openSession, setActiveSession, setActiveTab, close]
  );

  useKeyboard([
    { key: "Escape", handler: close },
    { key: "ArrowUp", handler: () => setSelected((i) => Math.max(0, i - 1)) },
    {
      key: "ArrowDown",
      handler: () => setSelected((i) => Math.min(Math.max(0, results.length - 1), i + 1)),
    },
    { key: "Enter", handler: () => void confirm() },
  ]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] palette-backdrop"
        onClick={close}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal
        className="fixed z-50 top-[15%] left-1/2 -translate-x-1/2
          w-full max-w-lg palette-panel
          bg-[var(--color-bg-2)] border border-[var(--color-border)]
          rounded-[var(--radius-lg)]
          shadow-[0_24px_64px_rgba(0,0,0,0.7)]
          overflow-hidden"
      >
        {/* Search row */}
        <div
          className="flex items-center gap-3 px-4 border-b border-[var(--color-border)]"
          style={{ height: 48 }}
        >
          <Search
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--color-ink-7)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions and terminals…"
            autoFocus
            className="flex-1 text-[13px] bg-transparent text-[var(--color-ink-0)]
              placeholder:text-[var(--color-ink-9)] outline-none"
          />
          <kbd
            className="text-[10px] text-[var(--color-ink-9)] shrink-0
            border border-[var(--color-border)] rounded-[var(--radius-xs)]
            px-1.5 py-0.5"
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[288px] overflow-y-auto">
          {state.type === "initial" && terminalResults.length === 0 && (
            <Status>Starting…</Status>
          )}

          {state.type === "loading" && terminalResults.length === 0 && (
            <Status>
              <Loader2 size={13} strokeWidth={1.8} className="mr-2 animate-spin" />
              Loading…
            </Status>
          )}

          {state.type === "error" && (
            <div className="space-y-2 px-4 py-4 text-center">
              <p className="text-[12px] text-[var(--color-danger)]">
                Failed to load sessions
              </p>
              <button
                onClick={loadSessions}
                className="text-[11px] text-[var(--color-accent)] hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {sessionResults.length > 0 && state.type === "data" && (
            <ResultSection title="Sessions">
              {sessionResults.map((session, index) => (
                <ResultRow
                  key={session.id}
                  selected={index === selectedIdx}
                  title={session.title}
                  subtitle={cwdShort(session.cwd)}
                  trailing={timeAgo(session.modified)}
                  onSelect={() => void confirm(index)}
                  onHover={() => setSelected(index)}
                />
              ))}
            </ResultSection>
          )}

          {terminalResults.length > 0 && (
            <ResultSection title="Terminals">
              {terminalResults.map((tab, offset) => {
                const index = sessionResults.length + offset;
                return (
                  <ResultRow
                    key={tab.id}
                    icon={<TerminalSquare size={13} strokeWidth={1.7} />}
                    selected={index === selectedIdx}
                    title={tab.title}
                    subtitle={cwdShort(tab.cwd)}
                    trailing={timeAgo(tab.createdAt)}
                    onSelect={() => void confirm(index)}
                    onHover={() => setSelected(index)}
                  />
                );
              })}
            </ResultSection>
          )}

          {(state.type === "data" || state.type === "empty") && results.length === 0 && (
            <Status>
              {q ? `No results for "${query}"` : "No sessions or terminals yet"}
            </Status>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 h-8
          border-t border-[var(--color-border)]
          text-[10px] text-[var(--color-ink-9)]"
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-9)]">
        {title}
      </h2>
      <ul role="listbox">{children}</ul>
    </section>
  );
}

function ResultRow({
  icon,
  selected,
  title,
  subtitle,
  trailing,
  onSelect,
  onHover,
}: {
  icon?: ReactNode;
  selected: boolean;
  title: string;
  subtitle: string;
  trailing: string;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5",
        "transition-colors duration-[var(--duration-fast)]",
        selected ? "bg-[var(--color-bg-active)]" : "hover:bg-[var(--color-bg-hover)]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-[var(--color-ink-7)]">{icon}</span>}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-[var(--color-ink-0)]">
            {title}
          </span>
          <span className="truncate font-mono text-[10.5px] text-[var(--color-ink-9)]">
            {subtitle}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--color-ink-9)]">
        {trailing}
      </span>
    </li>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center h-16 text-[12px] text-[var(--color-ink-7)]">
      {children}
    </div>
  );
}
