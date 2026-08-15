/**
 * Application workbench: global title bar, resizable session sidebar, terminal.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import CommandPalette from "@/components/CommandPalette";
import WorkspacePanel from "@/components/GitReview";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";

import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import TitleBar from "./TitleBar";

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 300;
const TERMINAL_MIN = 480;
const RESIZE_HANDLE_WIDTH = 6;
const STORAGE_KEY = "omp-sidebar-width";
const REVIEW_SIDEBAR_GAP = 16;

function availableSidebarMax() {
  if (window.innerWidth < 800) return Math.min(SIDEBAR_MAX, window.innerWidth);
  return Math.max(
    SIDEBAR_MIN,
    Math.min(SIDEBAR_MAX, window.innerWidth - TERMINAL_MIN - RESIZE_HANDLE_WIDTH)
  );
}

function clampSidebarWidth(width: number) {
  const minimum = Math.min(SIDEBAR_MIN, window.innerWidth);
  return Math.max(minimum, Math.min(availableSidebarMax(), width));
}

function getSavedWidth() {
  try {
    const saved = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
    return clampSidebarWidth(Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT);
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

export default function Layout() {
  const activeSession = useSessionStore((state) => state.activeSession);
  const activeTabId = useTerminalStore((state) => state.activeTabId);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const workspaceMode = useUiStore((state) => state.workspaceMode);
  const closeWorkspace = useUiStore((state) => state.closeWorkspace);
  const [width, setWidth] = useState(getSavedWidth);
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      const next = clampSidebarWidth(
        dragStartWidth.current + event.clientX - dragStartX.current
      );
      widthRef.current = next;
      setWidth(next);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(Math.round(widthRef.current)));
    };

    const onWindowResize = () => {
      setWidth(clampSidebarWidth(widthRef.current));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  const startResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <TitleBar />

      <div className="workbench relative flex min-h-0 flex-1 overflow-hidden">
        {!sidebarCollapsed && (
          <>
            <aside
              style={{ width, minWidth: width, maxWidth: width }}
              className="sidebar-panel flex h-full flex-col overflow-hidden
                bg-[var(--color-sidebar)]"
            >
              <Sidebar />
            </aside>

            <div
              role="separator"
              aria-label="Resize sidebar"
              aria-orientation="vertical"
              onMouseDown={startResize}
              className="resize-handle group relative z-10 w-1.5 shrink-0 cursor-col-resize"
            >
              <div
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2
                  bg-[var(--color-border)] transition-colors
                  duration-[var(--duration-fast)] group-hover:bg-[var(--color-accent)]"
              />
            </div>
          </>
        )}

        <main
          className="session-enter flex min-w-0 flex-1 flex-col overflow-hidden
            bg-[var(--color-bg)]"
        >
          {activeTabId ? <TerminalArea /> : <EmptyState />}
        </main>
        {workspaceMode && activeSession?.cwd && (
          <WorkspacePanel
            cwd={activeSession.cwd}
            leftInset={
              sidebarCollapsed ? 0 : width + RESIZE_HANDLE_WIDTH + REVIEW_SIDEBAR_GAP
            }
            mode={workspaceMode}
            onClose={closeWorkspace}
          />
        )}
      </div>

      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full select-none flex-col items-center justify-center gap-2.5">
      <span className="text-[30px] leading-none text-[var(--color-ink-9)]">π</span>
      <p className="text-[13px] text-[var(--color-ink-7)]">Select a session to resume</p>
      <p className="text-[11px] text-[var(--color-ink-9)]">⌘K — command palette</p>
    </div>
  );
}
