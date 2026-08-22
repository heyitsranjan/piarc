/**
 * @module components/CommandPalette
 * ⌘K / ⌘P overlay — search and open any session. All async states handled.
 */
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Loader2, Search } from "lucide-react";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";
import { ItemIcon } from "@/components/shared/ItemIcon";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";

import { useSessionStore } from "@/store/sessions";
import { isPlainTerminal, useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { fuzzyMatchAny } from "@/lib/fuzzy";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

export default function CommandPalette() {
  const { state, sessions, loadSessions } = useSessions();
  const { openSession } = useTerminal();
  const setSidebarMode = useUiStore((s) => s.setSidebarMode);
  const close = useUiStore((s) => s.closeCommandPalette);
  const touchRecentOpen = useUiStore((s) => s.touchRecentOpen);
  const recentOpens = useUiStore((s) => s.recentOpens);
  const tabs = useTerminalStore((s) => s.tabs);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const setActiveSession = useSessionStore((s) => s.setActive);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelected] = useState(-1);
  const resultsRef = useRef<HTMLDivElement>(null);

  const q = query.toLowerCase().trim();
  const { results } = useMemo(() => {
    const matchedSessions = sessions
      .filter(
        (session) =>
          !q || fuzzyMatchAny(q, session.title, session.cwd, session.firstMessage)
      )
      .map((session) => ({ kind: "session" as const, session }));

    const matchedTerminals = tabs
      .filter(
        (tab) => isPlainTerminal(tab) && (!q || fuzzyMatchAny(q, tab.title, tab.cwd))
      )
      .map((tab) => ({ kind: "terminal" as const, tab }));

    const matchedNotes = tabs
      .filter(
        (tab) => tab.kind === "note" && (!q || fuzzyMatchAny(q, tab.title, tab.content))
      )
      .map((tab) => ({ kind: "note" as const, tab }));

    const combined = [...matchedSessions, ...matchedTerminals, ...matchedNotes].sort(
      (a, b) => {
        const idA = a.kind === "session" ? a.session.id : a.tab.id;
        const idB = b.kind === "session" ? b.session.id : b.tab.id;
        return (recentOpens[idB] ?? 0) - (recentOpens[idA] ?? 0);
      }
    );

    return { results: combined };
  }, [sessions, tabs, q, recentOpens]);

  useEffect(() => {
    setSelected(-1);
  }, [query]);

  useEffect(() => {
    setSelected((index) => (index >= results.length ? results.length - 1 : index));
  }, [results.length]);

  useEffect(() => {
    if (selectedIdx < 0) return;
    resultsRef.current
      ?.querySelector<HTMLElement>(`[data-result-index="${selectedIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [results, selectedIdx]);

  const confirm = useCallback(
    async (index = selectedIdx) => {
      const result = results[index];
      if (!result) return;
      if (result.kind === "session") {
        touchRecentOpen(result.session.id);
        await openSession(result.session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
      } else {
        touchRecentOpen(result.tab.id);
        setSidebarMode(result.kind === "note" ? "terminals" : "all");
        setActiveSession(null);
        setActiveTab(result.tab.id);
      }
      close();
    },
    [
      results,
      selectedIdx,
      openSession,
      setActiveSession,
      setActiveTab,
      setSidebarMode,
      close,
      touchRecentOpen,
    ]
  );

  useKeyboard([
    {
      key: "Escape",
      handler: (event) => {
        event.stopImmediatePropagation();
        close();
      },
    },
    {
      key: "ArrowUp",
      handler: () => setSelected((i) => (i <= 0 ? results.length - 1 : i - 1)),
    },
    {
      key: "ArrowDown",
      handler: () => setSelected((i) => (i >= results.length - 1 ? 0 : i + 1)),
    },
    { key: "Enter", handler: () => void confirm() },
  ]);

  return (
    <>
      <div
        className="arc-dialog-backdrop fixed inset-0 z-50 palette-backdrop"
        onClick={close}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal
        className="arc-dialog-panel palette-panel fixed left-1/2 top-[15%] z-50 w-[520px] max-w-[calc(100vw-40px)] -translate-x-1/2 overflow-hidden border"
      >
        {/* Search row */}
        <div className="flex h-12 items-center gap-3 border-b border-[var(--color-border)] px-[15px]">
          <Search
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--color-ink-7)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, terminals, and notes…"
            autoFocus
            className="flex-1 bg-transparent font-mono text-[10px] text-[var(--color-ink-0)]
              placeholder:text-[var(--color-ink-9)] outline-none"
          />
          <kbd className="shrink-0 border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[8px] text-[var(--color-ink-9)]">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[288px] overflow-y-auto">
          {state.type === "initial" && results.length === 0 && <Status>Starting…</Status>}

          {state.type === "loading" && results.length === 0 && (
            <Status>
              <Loader2 size={13} strokeWidth={1.8} className="mr-2 animate-spin" />
              Loading…
            </Status>
          )}

          {state.type === "error" && (
            <div className="space-y-2 px-4 py-4 text-center">
              <p className="font-mono text-[9px] text-[var(--color-danger)]">
                Failed to load sessions
              </p>
              <button
                onClick={loadSessions}
                className="arc-dialog-button text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              >
                Retry
              </button>
            </div>
          )}

          {results.length > 0 && (
            <ul className="pb-2 pt-1">
              {results.map((result, index) => {
                const isSession = result.kind === "session";
                const isNote = result.kind === "note";
                const id = isSession ? result.session.id : result.tab.id;
                const title = isSession ? result.session.title : result.tab.title;
                const cwd = isSession ? result.session.cwd : result.tab.cwd;
                const trailing = isSession
                  ? timeAgo(result.session.modified)
                  : timeAgo(result.tab.createdAt);
                const icon = (
                  <ItemIcon
                    kind={isSession ? "session" : isNote ? "note" : "terminal"}
                    agent={!isSession && !isNote ? result.tab.agent : undefined}
                  />
                );
                const subtitle = isNote
                  ? `${timeAgo(result.tab.createdAt)} · ${result.tab.content.slice(0, 40)}`
                  : cwdShort(cwd);
                return (
                  <ResultRow
                    key={id}
                    icon={icon}
                    selected={index === selectedIdx}
                    title={title}
                    subtitle={subtitle}
                    trailing={trailing}
                    onSelect={() => void confirm(index)}
                    onHover={() => setSelected(index)}
                    index={index}
                  />
                );
              })}
            </ul>
          )}

          {(state.type === "data" || state.type === "empty") && results.length === 0 && (
            <Status>
              {q ? `No results for "${query}"` : "No sessions or terminals yet"}
            </Status>
          )}
        </div>

        {/* Footer */}
        <div className="flex h-8 items-center gap-4 border-t border-[var(--color-border)] px-[15px] font-mono text-[8px] text-[var(--color-ink-7)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
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
  index,
}: {
  icon?: ReactNode;
  selected: boolean;
  title: string;
  subtitle: string;
  trailing: string;
  onSelect: () => void;
  onHover: () => void;
  index: number;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      data-result-index={index}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        "group relative mx-1.5 flex h-12 cursor-pointer items-center justify-between gap-3 rounded-[4px] border border-transparent px-2 text-[var(--color-ink-1)] transition-colors duration-[var(--duration-fast)]",
        selected ? "arc-row-active" : "hover:text-[var(--color-ink-0)]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-[var(--color-ink-7)]">{icon}</span>}
        <div className="flex min-w-0 flex-col justify-center">
          <span
            className={cn(
              "block truncate font-mono text-[10px] font-semibold leading-[12px]",
              selected ? "text-[var(--color-accent)]" : "text-[var(--color-ink-1)]"
            )}
          >
            {title}
          </span>
          <span className="mt-1 block truncate font-mono text-[8px] leading-[9px] text-[var(--color-ink-7)]">
            {subtitle}
          </span>
        </div>
      </div>
      <span className="block w-[18px] shrink-0 text-right font-mono text-[7px] tabular-nums leading-[8px] text-[var(--color-ink-7)]">
        {trailing}
      </span>
    </li>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-16 items-center justify-center font-mono text-[9px] text-[var(--color-ink-7)]">
      {children}
    </div>
  );
}
