import CommandPalette from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

/**
 * Top-level shell: sidebar | terminal area.
 *
 * Conditionally renders:
 * - `<Sidebar>` unless the user has collapsed it.
 * - `<TerminalArea>` when a session is active, otherwise `<EmptyState>`.
 * - `<CommandPalette>` overlay when ⌘K is pressed.
 */
export default function Layout() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const cmdOpen = useUiStore((s) => s.commandPaletteOpen);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-bg)]">
      {!sidebarCollapsed && (
        <aside
          className="flex-shrink-0 border-r border-[var(--color-border)] overflow-hidden"
          style={{ width: "var(--sidebar-width)" }}
        >
          <Sidebar />
        </aside>
      )}

      <main className="flex-1 overflow-hidden flex flex-col">
        {activeSession ? <TerminalArea /> : <EmptyState />}
      </main>

      {cmdOpen && <CommandPalette />}
    </div>
  );
}

/**
 * Shown in the main pane when no session has been selected yet.
 * Hints at the two primary entry points: sidebar click and ⌘K.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <div className="text-[var(--color-ink-9)] text-5xl font-light">π</div>
      <p className="text-[var(--color-ink-5)] text-sm">Select a session to resume</p>
      <p className="text-[var(--color-ink-7)] text-xs">⌘K — command palette</p>
    </div>
  );
}
