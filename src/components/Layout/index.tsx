/**
 * @module components/Layout
 * App shell with a pixel-precise draggable sidebar.
 *
 * Custom resize handle — no library needed. Width persisted to localStorage.
 */
import { useEffect, useRef, useState } from "react";

import CommandPalette from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

const SIDEBAR_MIN  = 200;
const SIDEBAR_MAX  = 520;
const SIDEBAR_DEFAULT = 300;
const STORAGE_KEY  = "omp-sidebar-width";

function getSavedWidth(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n;
    }
  } catch { /* storage unavailable */ }
  return SIDEBAR_DEFAULT;
}

export default function Layout() {
  const activeSession    = useSessionStore((s) => s.activeSession);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const cmdOpen          = useUiStore((s) => s.commandPaletteOpen);

  const [width, setWidth] = useState(getSavedWidth);
  const dragging  = useRef(false);
  const startX    = useRef(0);
  const startW    = useRef(0);
  const isDragging = useRef(false);

  // Global mouse listeners — attached once, active only while dragging
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta  = e.clientX - startX.current;
      const next   = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW.current + delta));
      setWidth(next);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist width
      try { localStorage.setItem(STORAGE_KEY, String(Math.round(startW.current + 0))); } catch { /* */ }
      // Persist the actual current width on mouseup via a closure trick
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  // Persist width on change (debounced via mouseup above)
  useEffect(() => {
    if (!dragging.current) {
      try { localStorage.setItem(STORAGE_KEY, String(width)); } catch { /* */ }
    }
  }, [width]);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current   = true;
    isDragging.current = true;
    startX.current     = e.clientX;
    startW.current     = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      {!sidebarCollapsed && (
        <>
          <aside
            style={{ width, minWidth: width, maxWidth: width }}
            className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-elev)]"
          >
            <Sidebar />
          </aside>

          {/* Resize handle — 4px transparent grab area, 1px visual line */}
          <div
            role="separator"
            aria-label="Resize sidebar"
            onMouseDown={onHandleMouseDown}
            className="resize-handle group relative flex-shrink-0 w-1 cursor-col-resize z-10"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px
              bg-[var(--color-border)]
              group-hover:bg-[var(--color-accent)]
              transition-colors duration-[var(--duration-fast)]" />
          </div>
        </>
      )}

      {/* ── Terminal ─────────────────────────────────────────────────── */}
      <main
        key={activeSession?.id ?? "empty"}
        className="flex-1 flex flex-col overflow-hidden min-w-0 session-enter
          bg-[var(--color-bg)]"
      >
        {activeSession?.id ? <TerminalArea /> : <EmptyState />}
      </main>

      {cmdOpen && <CommandPalette />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3
      select-none">
      <span className="text-[28px] leading-none text-[var(--color-ink-9)]">π</span>
      <p className="text-[13px] text-[var(--color-ink-7)]">Select a session to resume</p>
      <p className="text-[11px] text-[var(--color-ink-9)]">⌘K — command palette</p>
    </div>
  );
}
