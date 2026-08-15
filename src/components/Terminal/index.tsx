/**
 * @module components/Terminal
 * Terminal area — no tab bar (sidebar handles navigation).
 *
 * Shows the active tab's terminal pane. Inactive tabs remain mounted and hidden,
 * preserving their xterm buffers and PTY processes for instant switching.
 */
import { useEffect, useRef } from "react";

import { writePty } from "@/lib/ipc";
import { useTerminalStore } from "@/store/terminal";

import RichInput from "./RichInput";
import TerminalEmpty from "./TerminalEmpty";
import TerminalTab from "./TerminalTab";

const DOUBLE_ESCAPE_MS = 600;

export default function TerminalArea() {
  const tabs = useTerminalStore((state) => state.tabs);
  const activeTabId = useTerminalStore((state) => state.activeTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const lastEscapeAt = useRef(0);

  useEffect(() => {
    lastEscapeAt.current = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        lastEscapeAt.current = 0;
        return;
      }

      if (!activeTab) return;
      // Keep Escape inside the terminal UI; macOS otherwise exits fullscreen.
      event.preventDefault();

      const now = window.performance.now();
      if (activeTab.isOutputting && now - lastEscapeAt.current <= DOUBLE_ESCAPE_MS) {
        event.stopPropagation();
        lastEscapeAt.current = 0;
        writePty(activeTab.id, "\x1b").catch(() => {});
        return;
      }
      lastEscapeAt.current = now;
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeTab]);

  if (tabs.length === 0) return <TerminalEmpty />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              aria-hidden={!active}
              className={`absolute inset-0 ${
                active ? "visible z-10" : "invisible z-0 pointer-events-none"
              }`}
            >
              <TerminalTab tab={tab} isVisible={active} />
            </div>
          );
        })}
      </div>
      {activeTab && <RichInput tab={activeTab} />}
    </div>
  );
}
