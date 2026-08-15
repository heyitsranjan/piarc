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

import { FEATURE_RICH_INPUT } from "@/lib/features";
import { writePty } from "@/lib/ipc";

import RichInput from "./RichInput";
import TerminalBottomBar from "./TerminalBottomBar";
import TerminalEmpty from "./TerminalEmpty";
import TerminalTab from "./TerminalTab";

const DOUBLE_ESCAPE_MS = 600;

export default function TerminalArea() {
  const tabs = useTerminalStore((state) => state.tabs);
  const activeTabId = useTerminalStore((state) => state.activeTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const richInputPreference = useUiStore((state) => state.richInputEnabled);
  const toggleRichInput = useUiStore((state) => state.toggleRichInput);
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
  }, [activeTab, richInputEnabled]);

  if (tabs.length === 0) return <TerminalEmpty />;

  const bottomControls =
    FEATURE_RICH_INPUT && activeTab?.kind === "omp" ? (
      <RichInputToggle enabled={richInputEnabled} onToggle={toggleRichInput} />
    ) : null;

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
      {activeTab &&
        (richInputEnabled ? (
          <RichInput key={activeTab.id} tab={activeTab} bottomControls={bottomControls} />
        ) : (
          <TerminalBottomBar
            left={activeTab.kind === "terminal" ? "Terminal" : "Direct terminal input"}
            right={bottomControls}
          />
        ))}
    </div>
  );
}

function RichInputToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <span className="text-[9px] text-[var(--color-ink-6)]">Rich input</span>
      <button
        type="button"
        role="switch"
        aria-label="Use rich input across the app"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
          p-0.5 transition-colors focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
          }`}
      >
        <span
          aria-hidden="true"
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </>
  );
}
