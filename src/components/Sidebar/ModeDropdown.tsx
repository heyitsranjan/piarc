/**
 * @module components/Sidebar/ModeDropdown
 * Dropdown for choosing which items appear in the sidebar.
 */
import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { useSessionStore } from "@/store/sessions";
import { isPlainTerminal, useTerminalStore } from "@/store/terminal";
import { type SidebarMode, useUiStore } from "@/store/ui";

import { cn } from "@/lib/utils";

const MODES: { value: SidebarMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sessions", label: "Sessions" },
  { value: "terminals", label: "Terminals" },
  { value: "notes", label: "Notes" },
];

export default function ModeDropdown() {
  const mode = useUiStore((state) => state.sidebarMode);
  const setMode = useUiStore((state) => state.setSidebarMode);
  const sessions = useSessionStore((state) => state.sessions);
  const tabs = useTerminalStore((state) => state.tabs);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sessionCount = sessions.length;
  const terminalCount = tabs.filter(isPlainTerminal).length;
  const noteCount = tabs.filter((t) => t.kind === "note").length;
  const counts: Record<SidebarMode, number> = {
    all: sessionCount + terminalCount + noteCount,
    sessions: sessionCount,
    terminals: terminalCount,
    notes: noteCount,
  };

  const activeLabel = MODES.find((m) => m.value === mode)?.label ?? "All";

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-[31px] items-center gap-1 rounded-[4px] border border-[var(--color-border)]",
          "bg-[var(--color-bg)] px-2 font-mono text-[9px] text-[var(--color-ink-1)]",
          "hover:text-[var(--color-ink-0)] focus:outline-none"
        )}
      >
        <span>{activeLabel}</span>
        <ChevronDown size={12} strokeWidth={1.8} className="text-[var(--color-ink-7)]" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Sidebar view"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[120px] overflow-hidden
            rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-lg"
        >
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setOpen(false);
              }}
              className={cn(
                "flex h-[27px] w-full items-center justify-between px-2.5 font-mono text-[9px]",
                "text-[var(--color-ink-1)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink-0)]",
                mode === value && "bg-[var(--color-hover)] text-[var(--color-ink-0)]"
              )}
            >
              <span>{label}</span>
              <span className="ml-3 tabular-nums text-[var(--color-accent)]">
                {counts[value]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
