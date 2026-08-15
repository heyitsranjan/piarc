/**
 * @module components/Sidebar
 * Left panel — session browser with all async states.
 */
import { Loader2, TerminalSquare, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";
import type { OmpSession } from "@/lib/session";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import SearchBar from "./SearchBar";
import SessionRow from "./SessionRow";
import SidebarHeader from "./SidebarHeader";

export default function Sidebar() {
  const { state, filtered, activeSession, loadSessions, pinnedIds } = useSessions();
  const { openSession } = useTerminal();
  const openCmdPalette = useUiStore((s) => s.openCommandPalette);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const setActiveSession = useSessionStore((s) => s.setActive);
  const terminals = tabs.filter((tab) => tab.kind === "terminal");

  useKeyboard([
    { key: "k", meta: true, handler: openCmdPalette },
    { key: "r", meta: true, handler: () => loadSessions() },
    { key: "b", meta: true, handler: toggleSidebar },
  ]);

  const handleSelect = async (session: OmpSession) => {
    const opening = openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
    if (window.innerWidth < 800) toggleSidebar();
    await opening;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SidebarHeader />
      <SearchBar />

      {/* ── State machine ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {state.type === "initial" && <Hint>Starting…</Hint>}
        {state.type === "loading" && <LoadingSkeleton />}
        {state.type === "error" && (
          <ErrorBanner message={state.message} onRetry={loadSessions} />
        )}
        {state.type === "empty" && <EmptyList />}
        {state.type === "data" && (
          <ul role="list" className="pb-3 pt-1">
            {filtered.map((session, idx) => {
              const isPinned = pinnedIds.includes(session.id);
              const prevPinned = idx > 0 && pinnedIds.includes(filtered[idx - 1].id);
              return (
                <Fragment key={session.id}>
                  {!isPinned && prevPinned && (
                    <li
                      aria-hidden
                      className="mx-3 my-1.5 border-t border-[var(--color-border)]"
                    />
                  )}
                  <SessionRow
                    session={session}
                    isActive={activeSession?.id === session.id}
                    onSelect={() => handleSelect(session)}
                  />
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center">
                <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
              </li>
            )}
          </ul>
        )}
        {terminals.length > 0 && (
          <section className="border-t border-[var(--color-border)] pb-2 pt-2">
            <h2 className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-9)]">
              Terminals
            </h2>
            <ul role="list">
              {terminals.map((tab) => (
                <li
                  key={tab.id}
                  className="group mx-1.5 flex items-center rounded-[var(--radius-sm)]"
                  data-active={activeTabId === tab.id || undefined}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSession(null);
                      setActiveTab(tab.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2
                      text-left text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]
                      group-data-[active=true]:bg-[var(--color-bg-active)] group-data-[active=true]:text-[var(--color-ink-1)]"
                  >
                    {tab.isLoading ? (
                      <Loader2 size={13} className="shrink-0 animate-spin" />
                    ) : (
                      <TerminalSquare size={13} className="shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11.5px]">
                      {tab.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    title={`Close ${tab.title}`}
                    aria-label={`Close ${tab.title}`}
                    onClick={() => void closeTab(tab.id)}
                    className="mr-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)]
                      text-[var(--color-ink-9)] hover:bg-[var(--color-bg-hi)] hover:text-[var(--color-ink-1)]
                      group-hover:flex group-focus-within:flex"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── State views ──────────────────────────────────────────────────────────

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center py-8">
      <p className="text-[12px] text-[var(--color-ink-9)]">{children}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <ul className="space-y-[3px] px-1.5 pt-0.5" aria-busy>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-[var(--radius-sm)] h-[44px]
            bg-[var(--color-bg-hover)]"
          style={{ opacity: 1 - i * 0.14 }}
        />
      ))}
    </ul>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="mx-2 mt-1 p-3 rounded-[var(--radius-md)]
      bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/15"
    >
      <p className="text-[11px] font-medium text-[var(--color-danger)] mb-1">
        Failed to load
      </p>
      <p className="text-[10.5px] text-[var(--color-ink-7)] mb-2 break-all leading-relaxed">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="text-[11px] text-[var(--color-accent)] hover:underline"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center h-28 gap-1.5 px-4 text-center">
      <p className="text-[12px] text-[var(--color-ink-7)]">No sessions yet</p>
      <p className="text-[10px] text-[var(--color-ink-9)] font-mono">
        ~/.omp/agent/sessions/
      </p>
    </div>
  );
}
