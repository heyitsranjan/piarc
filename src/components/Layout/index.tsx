/**
 * @module components/Layout
 * App shell — unified left chrome (sidebar) + full-height terminal.
 *
 * Structure:
 *   ┌── Sidebar (220px, bg-elev) ──┬── Terminal (flex-1, bg) ─────┐
 *   │  SidebarTop (38px drag area) │                               │
 *   │  [⊞] Oh My Pi       [+ New] │  full-height terminal output  │
 *   │  ─────────────────────────── │                               │
 *   │  search                      │                               │
 *   │  SESSIONS ─────────────────  │                               │
 *   │  • session row               │                               │
 *   └──────────────────────────────┴───────────────────────────────┘
 *
 * The sidebar + titlebar share --color-bg-elev, creating one unified chrome.
 * The terminal area uses --color-bg (darker canvas).
 */
import CommandPalette from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

export default function Layout() {
  const activeSession    = useSessionStore((s) => s.activeSession);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const cmdOpen          = useUiStore((s) => s.commandPaletteOpen);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      {/* ── Left chrome: sidebar (includes its own top/titlebar area) ─────── */}
      <aside
        className="sidebar-slide flex-shrink-0 flex flex-col overflow-hidden
          bg-[var(--color-bg-elev)] border-r border-[var(--color-border)]"
        style={{ width: sidebarCollapsed ? 0 : "var(--sidebar-width)" }}
        aria-hidden={sidebarCollapsed}
      >
        <Sidebar />
      </aside>

      {/* ── Main: full-height terminal (no top bar) ──────────────────────── */}
      <main
        key={activeSession?.id ?? "empty"}
        className="flex-1 flex flex-col overflow-hidden session-enter"
      >
        {activeSession?.id ? <TerminalArea /> : <EmptyState />}
      </main>

      {cmdOpen && <CommandPalette />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none
      bg-[var(--color-bg)]">
      <span className="text-[32px] leading-none" style={{ color: "var(--color-ink-9)" }}>
        π
      </span>
      <p className="text-[13px] text-[var(--color-ink-7)]">
        Select a session to resume
      </p>
      <p className="text-[11px] text-[var(--color-ink-9)]">
        ⌘K — command palette
      </p>
    </div>
  );
}
