/**
 * @module components/Sidebar/SessionRow
 * Single session row — full unified click area, Lucide icons.
 *
 * Title + CWD are in ONE <li> so every pixel of the row is clickable.
 * The ⋮ button stops propagation so it doesn't trigger onSelect.
 */
import { Copy, MoreVertical, Pin, PinOff, SquarePen } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";

import RenameDialog from "./RenameDialog";

interface SessionRowProps {
  session:  OmpSession;
  isActive: boolean;
  onSelect: () => void;
}

export default function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const { pinnedIds, togglePin } = useSessionStore();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const menuRef  = useRef<HTMLUListElement>(null);
  const isPinned = pinnedIds.includes(session.id);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <>
      {/* ONE unified clickable row — no split elements with dead zones */}
      <li
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
        className={cn(
          "group relative flex items-center gap-1.5",
          "mx-1.5 px-2 rounded-[var(--radius-sm)]",
          "py-[6px]",          // top+bottom padding → row feels 38-40px tall with two text lines
          "cursor-pointer select-none",
          "transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "bg-[var(--color-bg-active)] text-[var(--color-ink-0)]"
            : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-0)]"
        )}
      >
        {/* Left accent bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2
            w-[2px] h-[18px] rounded-r-full bg-[var(--color-accent)]" />
        )}

        {/* Pin icon */}
        {isPinned && (
          <span className="shrink-0 text-[var(--color-accent)] opacity-60 ml-0.5">
            <Pin size={9} fill="currentColor" strokeWidth={0} />
          </span>
        )}

        {/* Text block — title + cwd, takes all space */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[12.5px] font-medium truncate leading-snug">
              {session.title}
            </span>
            {/* Timestamp fades out on hover */}
            <span className={cn(
              "shrink-0 text-[10.5px] tabular-nums text-[var(--color-ink-9)] leading-none",
              "transition-opacity duration-[var(--duration-fast)]",
              "group-hover:opacity-0"
            )}>
              {timeAgo(session.modified)}
            </span>
          </div>
          <span className="block text-[10.5px] text-[var(--color-ink-9)]
            font-mono truncate mt-[2px] leading-none">
            {cwdShort(session.cwd)}
          </span>
        </div>

        {/* ⋮ — absolute overlay, visible on hover ─────────────────────── */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2
          opacity-0 group-hover:opacity-100
          transition-opacity duration-[var(--duration-fast)]">
          <button
            aria-label="Session options"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={cn(
              "flex items-center justify-center w-[20px] h-[20px]",
              "rounded-[var(--radius-xs)]",
              "text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)]",
              "hover:bg-[var(--color-bg-hi)]",
              "transition-colors duration-[var(--duration-fast)]",
              menuOpen && "opacity-100 bg-[var(--color-bg-hi)]"
            )}
          >
            <MoreVertical size={12} strokeWidth={2} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <ul
              ref={menuRef}
              role="menu"
              className="absolute right-0 top-full mt-1 z-50 w-44
                bg-[var(--color-bg-2)] border border-[var(--color-border)]
                rounded-[var(--radius-md)]
                shadow-[0_8px_32px_rgba(0,0,0,0.55)]
                py-0.5 overflow-hidden"
            >
              <DropdownItem
                icon={<SquarePen size={12} strokeWidth={1.8} />}
                onClick={() => { setMenuOpen(false); setRenameOpen(true); }}
              >
                Rename
              </DropdownItem>
              <DropdownItem
                icon={isPinned
                  ? <PinOff size={12} strokeWidth={1.8} />
                  : <Pin size={12} strokeWidth={1.8} />}
                onClick={() => { togglePin(session.id); setMenuOpen(false); }}
              >
                {isPinned ? "Unpin" : "Pin to top"}
              </DropdownItem>
              <DropdownItem
                icon={<Copy size={12} strokeWidth={1.8} />}
                onClick={() => {
                  navigator.clipboard.writeText(session.id);
                  setMenuOpen(false);
                }}
              >
                Copy session ID
              </DropdownItem>
            </ul>
          )}
        </div>
      </li>

      {renameOpen && (
        <RenameDialog session={session} onClose={() => setRenameOpen(false)} />
      )}
    </>
  );
}

function DropdownItem({
  icon, onClick, children,
}: {
  icon: ReactNode; onClick: () => void; children: ReactNode;
}) {
  return (
    <li
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-2.5 h-7 px-3 mx-0.5
        text-[12px] text-[var(--color-ink-1)] rounded-[var(--radius-xs)]
        cursor-pointer hover:bg-[var(--color-bg-hover)]
        hover:text-[var(--color-ink-0)]
        transition-colors duration-[var(--duration-fast)]"
    >
      <span className="text-[var(--color-ink-7)]">{icon}</span>
      {children}
    </li>
  );
}
