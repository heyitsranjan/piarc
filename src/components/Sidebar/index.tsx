/**
 * @module components/Sidebar
 * Left-panel session/terminal/note navigator.
 *
 * Renders from Tab[] only — the single source of truth.
 * - Agent tabs (omp / codex / claude) → SessionRow
 * - Plain terminal tabs               → TerminalRow
 * - Note tabs                         → TerminalRow
 *
 * React key is always `tab.id` (fresh UUID), never a session UUID.
 * No CombinedItem, no itemId bridge, no pendingSessions logic.
 */
import { Fragment, type ReactNode } from "react";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";

import { useSessions } from "@/hooks/useSessions";
import { useTerminal } from "@/hooks/useTerminal";

import { useSessionStore } from "@/store/sessions";
import { type Tab, isPlainTerminal, useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { fuzzyMatchAny } from "@/lib/fuzzy";

import SearchBar from "./SearchBar";
import SessionRow from "./SessionRow";
import { SortableItem, SortableList } from "./SortableList";
import TerminalRow from "./TerminalRow";

/** Sort tabs: pinned first, then by sidebarOrder, then by recency. */
function sortTabs(tabs: Tab[], order: string[]): Tab[] {
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  return [...tabs].sort((a, b) => {
    const aPin = Number(a.isPinned);
    const bPin = Number(b.isPinned);
    if (aPin !== bPin) return bPin - aPin;
    const aOrder = orderIdx.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderIdx.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

export default function Sidebar() {
  const { state, loadSessions } = useSessions();
  const { openSession, refreshSession, retryTab } = useTerminal();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarMode = useUiStore((s) => s.sidebarMode);
  const openNewDialog = useUiStore((s) => s.openNewDialog);
  const touchRecentOpen = useUiStore((s) => s.touchRecentOpen);
  const sidebarOrder = useUiStore((s) => s.sidebarOrder);
  const setSidebarOrder = useUiStore((s) => s.setSidebarOrder);

  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const updateTabTitle = useTerminalStore((s) => s.updateTabTitle);
  const toggleTabPin = useTerminalStore((s) => s.toggleTabPin);
  const searchQuery = useSessionStore((s) => s.searchQuery);

  const q = searchQuery.toLowerCase().trim();

  // ── Partition tabs by kind ──────────────────────────────────────────────
  const agentTabs = tabs.filter((t) => t.agent !== null && t.kind === "terminal");
  const terminalTabs = tabs.filter(isPlainTerminal);
  const noteTabs = tabs.filter((t) => t.kind === "note");

  // ── Filter by search query ──────────────────────────────────────────────
  const filteredAgents = agentTabs.filter(
    (t) => !q || fuzzyMatchAny(q, t.title, t.cwd, t.firstMessage)
  );
  const filteredTerminals = terminalTabs.filter(
    (t) => !q || fuzzyMatchAny(q, t.title, t.cwd)
  );
  const filteredNotes = noteTabs.filter(
    (t) => !q || fuzzyMatchAny(q, t.title, t.content)
  );

  // ── Build mode-specific lists ───────────────────────────────────────────
  const allTabs =
    sidebarMode === "sessions"
      ? filteredAgents
      : sidebarMode === "terminals"
        ? filteredTerminals
        : sidebarMode === "notes"
          ? filteredNotes
          : [...filteredAgents, ...filteredTerminals, ...filteredNotes];

  const sorted = sortTabs(allTabs, sidebarOrder);

  // ── DnD sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dndDisabled = q.length > 0;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = sorted.findIndex((t) => t.id === String(active.id));
    const overIdx = sorted.findIndex((t) => t.id === String(over.id));
    if (fromIdx === -1 || overIdx === -1) return;

    // Cross-section drop → toggle pin
    if (sorted[fromIdx].isPinned !== sorted[overIdx].isPinned) {
      toggleTabPin(sorted[fromIdx].id);
    }
    setSidebarOrder(
      arrayMove(
        sorted.map((t) => t.id),
        fromIdx,
        overIdx
      )
    );
  };

  // ── Row renderer ────────────────────────────────────────────────────────
  const renderTab = (tab: Tab) => {
    if (tab.agent !== null) {
      return (
        <SessionRow
          tab={tab}
          isActive={activeTabId === tab.id}
          onSelect={async () => {
            touchRecentOpen(tab.id);
            if (window.innerWidth < 800) toggleSidebar();
            // If the tab has a real session ID (not a pending __new__/__terminal__
            // placeholder), open/resume it. `path` may not be synced yet from
            // loadSessions(), but the resume command only needs sessionId.
            const isPending = !tab.sessionId || tab.sessionId.startsWith("__");
            if (!isPending) {
              await openSession(
                {
                  id: tab.sessionId,
                  path: tab.path,
                  title: tab.title,
                  cwd: tab.cwd,
                  modified: Math.floor(tab.modifiedAt),
                  firstMessage: tab.firstMessage,
                },
                TERMINAL_DEFAULT_COLS,
                TERMINAL_DEFAULT_ROWS,
                tab.agent ?? undefined
              );
            } else {
              // Pending — tab exists but session file not written yet.
              setActiveTab(tab.id);
            }
          }}
          onRefresh={() =>
            void refreshSession(
              {
                id: tab.sessionId,
                path: tab.path,
                title: tab.title,
                cwd: tab.cwd,
                modified: Math.floor(tab.modifiedAt),
                firstMessage: tab.firstMessage,
              },
              TERMINAL_DEFAULT_COLS,
              TERMINAL_DEFAULT_ROWS,
              tab.agent ?? undefined
            )
          }
        />
      );
    }
    return (
      <TerminalRow
        tab={tab}
        isActive={activeTabId === tab.id}
        onSelect={() => {
          touchRecentOpen(tab.id);
          setActiveTab(tab.id);
          if (tab.kind !== "note" && tab.error) {
            void retryTab(tab.id, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
          }
        }}
        onRename={(title) => updateTabTitle(tab.id, title)}
        onTogglePin={() => {
          toggleTabPin(tab.id);
        }}
        onDelete={() => void closeTab(tab.id)}
      />
    );
  };

  const renderList = (items: Tab[]) => {
    const pinnedCount = items.filter((t) => t.isPinned).length;
    const recentCount = items.length - pinnedCount;

    return (
      <SortableList ids={items.map((t) => t.id)} disabled={dndDisabled}>
        <ul role="list" className="pb-3">
          {items.map((tab, idx) => {
            const prevPinned = idx > 0 && items[idx - 1].isPinned;
            const startsSection = idx === 0 || tab.isPinned !== prevPinned;
            const sectionCount = tab.isPinned ? pinnedCount : recentCount;
            return (
              <Fragment key={tab.id}>
                {startsSection && (
                  <li
                    className="flex items-center justify-between px-[7px] pb-[5px] pt-[9px]
                      font-mono text-[7px] font-semibold uppercase tracking-[0.08em]
                      text-[var(--color-ink-9)]"
                  >
                    <span>{tab.isPinned ? "Pinned" : "Recent"}</span>
                    <span className="tabular-nums text-[var(--color-accent)]">
                      {sectionCount}
                    </span>
                  </li>
                )}
                <SortableItem id={tab.id} disabled={dndDisabled}>
                  {renderTab(tab)}
                </SortableItem>
              </Fragment>
            );
          })}
          {items.length === 0 && (
            <li className="px-3 py-6 text-center">
              <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
            </li>
          )}
        </ul>
      </SortableList>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          {sidebarMode === "sessions" && (
            <>
              {state.type === "initial" && <Hint>Starting…</Hint>}
              {state.type === "loading" && <LoadingSkeleton />}
              {state.type === "error" && (
                <ErrorBanner message={state.message} onRetry={loadSessions} />
              )}
              {state.type === "empty" && <EmptyList />}
              {state.type === "data" && renderList(sorted)}
            </>
          )}
          {sidebarMode !== "sessions" && renderList(sorted)}
        </DndContext>
      </div>
      <div className="arc-sidebar-footer">
        <button
          type="button"
          className="arc-sidebar-create"
          onClick={openNewDialog}
          aria-label="Create new session, terminal, or note"
          title="Create new session, terminal, or note (⌘N)"
        >
          <span className="arc-sidebar-create-label">New Session / Terminal / Note</span>
          <kbd className="arc-sidebar-create-shortcut">⌘ N</kbd>
        </button>
      </div>
    </div>
  );
}

// ─── State views ──────────────────────────────────────────────────────────

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[12px] text-[var(--color-ink-7)]">{children}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <ul className="px-0 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse px-3 py-[7px]"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-2">
            <div className="h-[18px] w-[18px] rounded-[3px] bg-[var(--color-border)]" />
            <div className="flex-1">
              <div className="h-[10px] w-2/3 rounded-[2px] bg-[var(--color-border)]" />
              <div className="mt-[3px] h-[8px] w-1/2 rounded-[2px] bg-[var(--color-border)]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[12px] text-[var(--color-error)]">{message}</p>
      <button
        type="button"
        className="mt-2 rounded-[2px] border border-[var(--color-border)] px-2 py-1 text-[10px]
          text-[var(--color-ink-3)] hover:bg-[var(--color-border)]"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyList() {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[12px] text-[var(--color-ink-7)]">No sessions found</p>
      <p className="mt-1 text-[10px] text-[var(--color-ink-9)]">
        Run <code className="text-[var(--color-accent)]">omp</code> in a terminal to start
        one.
      </p>
    </div>
  );
}
