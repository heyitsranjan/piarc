/**
 * @module components/Layout
 * App shell — draggable sidebar via react-resizable-panels v4.
 * v4 API: Group + Panel + Separator (renamed from PanelGroup/PanelResizeHandle).
 */
import { Group, Panel, Separator } from "react-resizable-panels";

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
      <Group orientation="horizontal" className="flex-1">
        {!sidebarCollapsed && (
          <>
            <Panel
              id="sidebar"
              defaultSize={20}
              minSize={14}
              maxSize={38}
              className="bg-[var(--color-bg-elev)]"
            >
              <Sidebar />
            </Panel>
            {/* 1px separator — glows accent on hover/drag via global.css */}
            <Separator aria-label="Resize sidebar" />
          </>
        )}

        <Panel id="terminal" className="flex flex-col overflow-hidden">
          <main
            key={activeSession?.id ?? "empty"}
            className="flex-1 flex flex-col overflow-hidden session-enter"
          >
            {activeSession?.id ? <TerminalArea /> : <EmptyState />}
          </main>
        </Panel>
      </Group>

      {cmdOpen && <CommandPalette />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3
      select-none bg-[var(--color-bg)]">
      <span className="text-[28px] leading-none text-[var(--color-ink-9)]">π</span>
      <p className="text-[13px] text-[var(--color-ink-7)]">Select a session to resume</p>
      <p className="text-[11px] text-[var(--color-ink-9)]">⌘K — command palette</p>
    </div>
  );
}
