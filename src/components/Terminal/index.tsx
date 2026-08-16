/**
 * @module components/Terminal
 * Terminal area — no tab bar (sidebar handles navigation).
 *
 * Shows the active tab's terminal pane. Inactive tabs remain mounted and hidden,
 * preserving their xterm buffers and PTY processes for instant switching.
 */
import { useEffect, useRef } from "react";

import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { isAgentWorking } from "@/lib/agent-activity";
import { FEATURE_RICH_INPUT } from "@/lib/features";
import { writePty } from "@/lib/ipc";

import RichInput from "./RichInput";
import TerminalEmpty from "./TerminalEmpty";
import TerminalTab from "./TerminalTab";

const DOUBLE_ESCAPE_MS = 600;

export default function TerminalArea() {
  const tabs = useTerminalStore((state) => state.tabs);
  const activeTabId = useTerminalStore((state) => state.activeTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const richInputPreference = useUiStore((state) => state.richInputEnabled);
  const richInputEnabled =
    FEATURE_RICH_INPUT && richInputPreference && activeTab?.kind === "omp";
  const lastEscapeAt = useRef(0);

  useEffect(() => {
    if (!richInputEnabled) return;
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
      if (
        isAgentWorking(activeTab.activity) &&
        now - lastEscapeAt.current <= DOUBLE_ESCAPE_MS
      ) {
        event.stopPropagation();
        lastEscapeAt.current = 0;
        writePty(activeTab.id, "\x1b").catch(() => {});
        return;
      }
      lastEscapeAt.current = now;
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeTab, richInputEnabled]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="relative min-h-0 flex-1">
        {!activeTab && <TerminalEmpty />}
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
      {activeTab && richInputEnabled && <RichInput key={activeTab.id} tab={activeTab} />}
    </div>
  );
}
