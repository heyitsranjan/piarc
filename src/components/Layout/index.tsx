/**
 * @module components/Layout
 * Top-level shell: sidebar | terminal area.
 *
 * - Sidebar slides in/out via CSS width transition (⌘B toggle).
 * - Main pane plays `session-enter` fade when the active session changes.
 * - Command palette overlay animates in on open.
 */

import CommandPalette from "@/components/CommandPalette";
import TitleBar from "@/components/Layout/TitleBar";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

export default function Layout() {
  const activeSession    = useSessionStore((s) => s.activeSession);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const cmdOpen          = useUiStore((s) => s.commandPaletteOpen);

  // Re-key the main pane on session change → triggers session-enter CSS animation
  const sessionKey = activeSession?.id ?? "empty";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Window titlebar (drag region + sidebar toggle) */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — animated width on collapse */}
        <aside
          className="sidebar-slide flex-shrink-0 border-r border-[var(--color-border)] overflow-hidden"
          style={{ width: sidebarCollapsed ? 0 : "var(--sidebar-width)" }}
          aria-hidden={sidebarCollapsed}
        >
          <Sidebar />
        </aside>

        {/* Main pane — session-enter animation on every session switch */}
        <main
          key={sessionKey}
          className="flex-1 overflow-hidden flex flex-col session-enter"
        >
          {activeSession ? <TerminalArea /> : <EmptyState />}
        </main>
      </div>

      {/* Command palette overlay */}
      {cmdOpen && <CommandPalette />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <div className="text-[var(--color-ink-9)] text-5xl font-light">π</div>
      <p className="text-[var(--color-ink-5)] text-sm">Select a session to resume</p>
      <p className="text-[var(--color-ink-7)] text-xs">⌘K — command palette</p>
    </div>
  );
}
