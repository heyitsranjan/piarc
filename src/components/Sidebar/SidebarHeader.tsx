/** Compact collection switcher for sessions and plain terminals. */
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
  return (
    <div
      role="tablist"
      aria-label="Sidebar view"
      className="mx-2 mb-[5px] mt-2 grid shrink-0 grid-cols-2 gap-0.5 rounded-[2px] border
        border-[var(--color-border)] bg-[#0a0b0d] p-0.5"
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
            "arc-side-tab h-[25px] rounded-[2px] border-0 px-[6px] py-px font-mono text-[8px]",
            "uppercase tracking-[0.08em] transition-colors hover:text-[var(--color-ink-1)]",
            mode === value && "arc-side-tab-active"
          )}
        >
          <span>{label}</span>
          <span className="ml-[5px] font-medium tabular-nums text-[var(--color-accent)]">
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}
