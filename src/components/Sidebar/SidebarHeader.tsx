/** Sidebar hierarchy, collection switcher, and refresh action. */
import { Loader2, RotateCcw } from "lucide-react";

import { useSessionStore } from "@/store/sessions";
import type { SidebarMode } from "@/store/ui";

import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
  mode: SidebarMode;
  sessionCount: number;
  terminalCount: number;
  onModeChange: (mode: SidebarMode) => void;
}

export default function SidebarHeader({
  mode,
  sessionCount,
  terminalCount,
  onModeChange,
}: SidebarHeaderProps) {
  const isLoading = useSessionStore((state) => state.isLoading);
  const loadSessions = useSessionStore((state) => state.loadSessions);

  return (
    <div className="shrink-0 border-b border-[var(--color-border-2)]">
      <div className="flex h-10 items-center justify-between px-3">
        <span className="text-[12px] font-semibold text-[var(--color-ink-1)]">
          Workspace
        </span>
        <button
          type="button"
          onClick={() => loadSessions()}
          title="Refresh sessions (⌘R)"
          aria-label="Refresh sessions"
          className="sidebar-toolbar-button"
        >
          {isLoading ? (
            <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <RotateCcw size={15} strokeWidth={1.8} />
          )}
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Sidebar view"
        className="mx-2 mb-2 grid grid-cols-2 rounded-[var(--radius-sm)] bg-[var(--color-input)] p-0.5"
      >
        {(
          [
            ["sessions", "Sessions", sessionCount],
            ["terminals", "Terminals", terminalCount],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => onModeChange(value)}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded-[3px] text-[11px]",
              "text-[var(--color-ink-7)] transition-colors hover:text-[var(--color-ink-1)]",
              mode === value &&
                "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)] shadow-sm"
            )}
          >
            <span>{label}</span>
            <span
              className={cn(
                "min-w-4 rounded-full px-1 text-[9px] tabular-nums",
                mode === value
                  ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-9)]"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
