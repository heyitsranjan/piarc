/**
 * @module components/CommandPalette/PaletteItem
 * A single result row inside the command palette list.
 * Highlighted via `isSelected` (keyboard navigation driven by parent).
 */
import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

interface PaletteItemProps {
  session: OmpSession;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PaletteItem({ session, isSelected, onSelect }: PaletteItemProps) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer",
        "transition-colors duration-[var(--duration-fast)]",
        isSelected ? "bg-[var(--color-accent-dim)]" : "hover:bg-[var(--color-bg-hover)]"
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-[var(--color-ink-0)] truncate">
          {session.title}
        </span>
        <span className="text-[10px] text-[var(--color-ink-7)] font-mono truncate">
          {cwdShort(session.cwd)}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-ink-7)] shrink-0 tabular-nums">
        {timeAgo(session.modified)}
      </span>
    </li>
  );
}
