/**
 * @module components/Sidebar
 * Left panel — session browser with all async states.
 *
 * Supports drag-to-reorder and drag-to-pin in all three modes.
 * "all" mode shows Pinned/Recent section headers; other modes are flat.
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

import { useTerminalStore } from "@/store/terminal";
import type { Tab } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import type { OmpSession } from "@/lib/session";

import SearchBar from "./SearchBar";
import SessionRow from "./SessionRow";
import { SortableItem, SortableList } from "./SortableList";
import TerminalRow from "./TerminalRow";

type CombinedItem =
  { kind: "session"; session: OmpSession } | { kind: "terminal"; tab: Tab };

/** Item ID extraction helper. */
function itemId(item: CombinedItem, tabs: Tab[]): string {
  if (item.kind === "session") {
    // Use tab.id if a tab is bound to this session — keeps the sidebar key
    // stable across the pending→real session ID transition.
    const tab = tabs.find((t) => t.sessionId === item.session.id);
    return tab?.id ?? item.session.id;
  }
  return item.tab.id;
}

/**
 * Sort items: pinned first, then by sidebarOrder.
 * Items not in sidebarOrder go to the end (natural order preserved via stable sort).
 * No recency or automated re-sorting — only drag order and new-item prepend.
 */
function sortByOrder(
  items: CombinedItem[],
  order: string[],
  pinned: (item: CombinedItem) => boolean,
  tabs: Tab[]
): CombinedItem[] {
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const aPin = Number(pinned(a));
    const bPin = Number(pinned(b));
    if (aPin !== bPin) return bPin - aPin;
    const aOrder = orderIdx.get(itemId(a, tabs)) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderIdx.get(itemId(b, tabs)) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

export default function Sidebar() {
  const {
    state,
    sessions,
    filtered,
    activeSession,
    loadSessions,
    pinnedIds,
    searchQuery,
    togglePin,
  } = useSessions();
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
  const allTerminals = tabs.filter((tab) => tab.kind === "terminal");
  const allNotes = tabs.filter((tab) => tab.kind === "note");
  // OMP tabs that don't yet have an on-disk session — show as pending sessions.
  const sessionIds = new Set(sessions.map((s) => s.id));
  const pendingSessions: OmpSession[] = tabs
    .filter((tab) => tab.kind === "omp" && !sessionIds.has(tab.sessionId))
    .map((tab) => ({
      id: tab.id, // use tab ID for sidebar ordering (matches prependSidebarOrder)
      path: "",
      title: tab.title || "New session",
      cwd: tab.cwd,
      modified: Math.floor(tab.createdAt / 1000),
      firstMessage: "",
    }));
  const q = searchQuery.toLowerCase().trim();

  // DnD sensors — distance constraint distinguishes click from drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Pin check helpers ─────────────────────────────────────────────────
  const isPinned = (item: CombinedItem): boolean => {
    if (item.kind === "session") {
      // Use tab.id for pin check if a tab is bound — consistent with itemId.
      const tab = tabs.find((t) => t.sessionId === item.session.id);
      return pinnedIds.includes(tab?.id ?? item.session.id);
    }
    return item.tab.isPinned;
  };
  // ── Build filtered terminal list ──────────────────────────────────────
  const terminalMatches = (tab: Tab) =>
    !q || tab.title.toLowerCase().includes(q) || tab.cwd.toLowerCase().includes(q);
  const filteredTerminals = allTerminals.filter(terminalMatches);

  const noteMatches = (tab: Tab) =>
    !q || tab.title.toLowerCase().includes(q) || tab.content.toLowerCase().includes(q);
  const filteredNotes = allNotes.filter(noteMatches);

  // Pending sessions (OMP tabs without on-disk JSONL yet), filtered by search.
  const pendingMatches = (s: OmpSession) =>
    !q || s.title.toLowerCase().includes(q) || s.cwd.toLowerCase().includes(q);
  const filteredPending = pendingSessions.filter(pendingMatches);

  // ── Build combined "all" list ─────────────────────────────────────────
  const allItems: CombinedItem[] = [
    ...filtered.map((s) => ({ kind: "session" as const, session: s })),
    ...filteredPending.map((s) => ({ kind: "session" as const, session: s })),
    ...filteredTerminals.map((t) => ({ kind: "terminal" as const, tab: t })),
    ...filteredNotes.map((t) => ({ kind: "terminal" as const, tab: t })),
  ];
  const sortedAll = sortByOrder(allItems, sidebarOrder, isPinned, tabs);

  // ── Build sessions-only list ──────────────────────────────────────────
  const sessionItems: CombinedItem[] = [
    ...filtered.map((s) => ({ kind: "session" as const, session: s })),
    ...filteredPending.map((s) => ({ kind: "session" as const, session: s })),
  ];
  const sortedSessions = sortByOrder(sessionItems, sidebarOrder, () => false, tabs);

  // ── Build terminals-only list ─────────────────────────────────────────
  const terminalItems = filteredTerminals.map((t) => ({
    kind: "terminal" as const,
    tab: t,
  }));
  const sortedTerminals = sortByOrder(terminalItems, sidebarOrder, () => false, tabs);

  // ── Build notes-only list ─────────────────────────────────────────────
  const noteItems = filteredNotes.map((t) => ({ kind: "terminal" as const, tab: t }));
  const sortedNotes = sortByOrder(noteItems, sidebarOrder, () => false, tabs);

  /** Toggle pin for any item type. */
  const toggleItemPin = (item: CombinedItem) => {
    if (item.kind === "session") {
      // Pin by tab.id if a tab is bound — consistent with itemId and isPinned.
      const tab = tabs.find((t) => t.sessionId === item.session.id);
      togglePin(tab?.id ?? item.session.id);
    } else {
      toggleTabPin(item.tab.id);
    }
  };

  // ── Drag end handler ──────────────────────────────────────────────────
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine which list we're operating on
    let list: CombinedItem[];
    if (sidebarMode === "all") list = sortedAll;
    else if (sidebarMode === "sessions") list = sortedSessions;
    else if (sidebarMode === "terminals") list = sortedTerminals;
    else list = sortedNotes;

    const fromIdx = list.findIndex((it) => itemId(it, tabs) === activeId);
    const overIdx = list.findIndex((it) => itemId(it, tabs) === overId);
    if (fromIdx === -1 || overIdx === -1) return;

    // Cross-section drop: if pin states differ, toggle pin on the dragged item
    const activeItem = list[fromIdx];
    const overItem = list[overIdx];
    if (isPinned(activeItem) !== isPinned(overItem)) {
      toggleItemPin(activeItem);
    }

    // Reorder in sidebarOrder
    const ids = list.map((it) => itemId(it, tabs));
    const newOrder = arrayMove(ids, fromIdx, overIdx);
    setSidebarOrder(newOrder);
  };

  const handleSelect = async (session: OmpSession) => {
    touchRecentOpen(session.id);
    // Pending session (no JSONL yet) — just switch to its tab.
    if (!session.path) {
      const tab = tabs.find((t) => t.id === session.id);
      if (tab) setActiveTab(tab.id);
      if (window.innerWidth < 800) toggleSidebar();
      return;
    }
    const opening = openSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
    if (window.innerWidth < 800) toggleSidebar();
    await opening;
  };

  const handleRefresh = (session: OmpSession) =>
    refreshSession(session, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);

  // DnD disabled while searching
  const dndDisabled = q.length > 0;

  // ── Row renderer ──────────────────────────────────────────────────────
  const renderItem = (item: CombinedItem) =>
    item.kind === "session" ? (
      <SessionRow
        session={item.session}
        isActive={
          activeSession?.id === item.session.id || activeTabId === item.session.id
        }
        onSelect={() => handleSelect(item.session)}
        onRefresh={() => void handleRefresh(item.session)}
      />
    ) : (
      <TerminalRow
        tab={item.tab}
        isActive={activeTabId === item.tab.id}
        onSelect={() => {
          touchRecentOpen(item.tab.id);
          setActiveTab(item.tab.id);
          if (item.tab.kind !== "note" && item.tab.error) {
            void retryTab(item.tab.id, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
          }
        }}
        onRename={(title) => updateTabTitle(item.tab.id, title)}
        onTogglePin={() => toggleTabPin(item.tab.id)}
        onDelete={() => void closeTab(item.tab.id)}
      />
    );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar />

      {/* ── State machine ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          {sidebarMode === "all" && (
            <SortableList
              ids={sortedAll.map((it) => itemId(it, tabs))}
              disabled={dndDisabled}
            >
              <ul role="list" className="pb-3">
                {sortedAll.map((item, idx) => {
                  const pinned = isPinned(item);
                  const prevPinned = idx > 0 && isPinned(sortedAll[idx - 1]);
                  const startsSection = idx === 0 || pinned !== prevPinned;
                  return (
                    <Fragment key={itemId(item, tabs)}>
                      {startsSection && (
                        <li
                          className="px-[7px] pb-[5px] pt-[9px] font-mono text-[7px] font-semibold uppercase
                            tracking-[0.08em] text-[var(--color-ink-9)]"
                        >
                          {pinned ? "Pinned" : "Recent"}
                        </li>
                      )}
                      <SortableItem id={itemId(item, tabs)} disabled={dndDisabled}>
                        {renderItem(item)}
                      </SortableItem>
                    </Fragment>
                  );
                })}
                {sortedAll.length === 0 && (
                  <li className="px-3 py-6 text-center">
                    <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
                  </li>
                )}
              </ul>
            </SortableList>
          )}

          {sidebarMode === "sessions" && (
            <>
              {state.type === "initial" && <Hint>Starting…</Hint>}
              {state.type === "loading" && <LoadingSkeleton />}
              {state.type === "error" && (
                <ErrorBanner message={state.message} onRetry={loadSessions} />
              )}
              {state.type === "empty" && <EmptyList />}
              {state.type === "data" && (
                <SortableList
                  ids={sortedSessions.map((it) => itemId(it, tabs))}
                  disabled={dndDisabled}
                >
                  <ul role="list" className="pb-3">
                    {sortedSessions.map((item) => (
                      <SortableItem
                        key={itemId(item, tabs)}
                        id={itemId(item, tabs)}
                        disabled={dndDisabled}
                      >
                        {renderItem(item)}
                      </SortableItem>
                    ))}
                    {sortedSessions.length === 0 && (
                      <li className="px-3 py-6 text-center">
                        <p className="text-[12px] text-[var(--color-ink-7)]">
                          No results
                        </p>
                      </li>
                    )}
                  </ul>
                </SortableList>
              )}
            </>
          )}

          {sidebarMode === "terminals" && (
            <SortableList
              ids={sortedTerminals.map((it) => itemId(it, tabs))}
              disabled={dndDisabled}
            >
              <ul role="list" className="pb-3">
                {sortedTerminals.map((item) => (
                  <SortableItem
                    key={itemId(item, tabs)}
                    id={itemId(item, tabs)}
                    disabled={dndDisabled}
                  >
                    {renderItem(item)}
                  </SortableItem>
                ))}
                {sortedTerminals.length === 0 && (
                  <li className="px-3 py-6 text-center">
                    <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
                  </li>
                )}
              </ul>
            </SortableList>
          )}

          {sidebarMode === "notes" && (
            <SortableList
              ids={sortedNotes.map((it) => itemId(it, tabs))}
              disabled={dndDisabled}
            >
              <ul role="list" className="pb-3">
                {sortedNotes.map((item) => (
                  <SortableItem
                    key={itemId(item, tabs)}
                    id={itemId(item, tabs)}
                    disabled={dndDisabled}
                  >
                    {renderItem(item)}
                  </SortableItem>
                ))}
                {sortedNotes.length === 0 && (
                  <li className="px-3 py-6 text-center">
                    <p className="text-[12px] text-[var(--color-ink-7)]">No results</p>
                  </li>
                )}
              </ul>
            </SortableList>
          )}
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
