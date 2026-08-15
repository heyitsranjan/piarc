/**
 * @module components/Sidebar
 * Left panel — session browser with all async states.
 */
import { Fragment, type ReactNode } from "react";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";

import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import type { OmpSession } from "@/lib/session";

import SearchBar from "./SearchBar";
import SessionRow from "./SessionRow";
import SidebarHeader from "./SidebarHeader";
import TerminalRow from "./TerminalRow";

export default function Sidebar() {
  const ompStatus = useOmpStore((state) => state.status);
  const refreshOmp = useOmpStore((state) => state.refresh);
  const {
    state,
    sessions,
    filtered,
    activeSession,
    loadSessions,
    pinnedIds,
    searchQuery,
  } = useSessions();
  const { openSession, retryTab } = useTerminal();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarMode = useUiStore((s) => s.sidebarMode);
  const setSidebarMode = useUiStore((s) => s.setSidebarMode);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const updateTabTitle = useTerminalStore((s) => s.updateTabTitle);
  const toggleTabPin = useTerminalStore((s) => s.toggleTabPin);
  const setActiveSession = useSessionStore((s) => s.setActive);
  const allTerminals = tabs.filter((tab) => tab.kind === "terminal");
  const q = searchQuery.toLowerCase().trim();
  const terminals = allTerminals
    .filter(
      (tab) =>
        !q || tab.title.toLowerCase().includes(q) || tab.cwd.toLowerCase().includes(q)
    )
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

  const handleSelect = async (session: OmpSession) => {
    const opening = openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
    if (window.innerWidth < 800) toggleSidebar();
    await opening;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SidebarHeader
        mode={sidebarMode}
        sessionCount={sessions.length}
        terminalCount={allTerminals.length}
        onModeChange={setSidebarMode}
      />
      <SearchBar />
      {ompStatus && !ompStatus.installed && (
        <div className="mx-2 mb-2 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/8 p-2.5">
          <p className="text-[11px] font-medium text-[var(--color-danger)]">
            OMP required
          </p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--color-ink-7)]">
            Install OMP from omp.sh, then refresh.
          </p>
          <button
            type="button"
            onClick={() => void refreshOmp()}
            className="mt-1.5 text-[10px] text-[var(--color-accent)] hover:underline"
          >
            Check again
          </button>
        </div>
      )}

      {/* ── State machine ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sidebarMode === "sessions" && (
          <>
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
                  const startsSection = idx === 0 || (!isPinned && prevPinned);
                  return (
                    <Fragment key={session.id}>
                      {startsSection && (
                        <li
                          aria-hidden
                          className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase
                            tracking-[0.08em] text-[var(--color-ink-9)]"
                        >
                          {isPinned ? "Pinned" : "Recent"}
                        </li>
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
          </>
        )}
        {sidebarMode === "terminals" && (
          <ul role="list" className="pb-3 pt-1">
            {terminals.map((tab) => (
              <TerminalRow
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                onSelect={() => {
                  setActiveSession(null);
                  setActiveTab(tab.id);
                  if (tab.error) {
                    void retryTab(tab.id, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
                  }
                }}
                onRename={(title) => updateTabTitle(tab.id, title)}
                onTogglePin={() => toggleTabPin(tab.id)}
                onDelete={() => void closeTab(tab.id)}
              />
            ))}
            {terminals.length === 0 && (
              <li className="px-3 py-6 text-center">
                <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
              </li>
            )}
          </ul>
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
