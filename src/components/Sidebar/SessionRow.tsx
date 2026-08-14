/**
 * @module components/Sidebar/SessionRow
 * 32px session row — Linear-inspired with left accent bar for active state.
 *
 * - Click → open in terminal
 * - ⋮ button on hover → Rename | Pin/Unpin | Copy session ID
 * - Rename → RenameDialog modal
 */
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
      <li
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
        className={cn(
          // 32px row, full width, relative for accent bar
          "group relative flex items-center gap-1.5",
          "h-8 px-2 mx-1 rounded-[var(--radius-sm)]",
          "cursor-pointer select-none",
          "transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "bg-[var(--color-bg-active)] text-[var(--color-ink-0)]"
            : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-0)]"
        )}
      >
        {/* Left accent bar — only when active */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2
            w-0.5 h-4 bg-[var(--color-accent)] rounded-r-full" />
        )}

        {/* Pin icon */}
        {isPinned && (
          <span className="shrink-0 text-[var(--color-accent)] opacity-70" title="Pinned">
            <PinIcon />
          </span>
        )}

        {/* Title — takes remaining space */}
        <span className="flex-1 text-[12.5px] font-medium truncate leading-none">
          {session.title}
        </span>

        {/* Timestamp — hidden on hover to show ⋮ */}
        <span className={cn(
          "shrink-0 text-[10.5px] tabular-nums text-[var(--color-ink-9)]",
          "group-hover:hidden"
        )}>
          {timeAgo(session.modified)}
        </span>

        {/* ⋮ — shown on hover */}
        <div className="relative shrink-0 hidden group-hover:flex">
          <button
            aria-label="Session options"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={cn(
              "flex items-center justify-center w-5 h-5",
              "rounded-[var(--radius-xs)] transition-colors",
              "text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)]",
              "hover:bg-[var(--color-bg-hi)]",
              menuOpen && "opacity-100 bg-[var(--color-bg-hi)]"
            )}
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <ul
              ref={menuRef}
              role="menu"
              className="absolute right-0 top-full mt-1 z-50 w-44
                bg-[var(--color-bg-2)] border border-[var(--color-border)]
                rounded-[var(--radius-md)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-0.5"
            >
              <DropdownItem onClick={() => { setMenuOpen(false); setRenameOpen(true); }}>
                Rename
              </DropdownItem>
              <DropdownItem onClick={() => { togglePin(session.id); setMenuOpen(false); }}>
                {isPinned ? "Unpin" : "Pin to top"}
              </DropdownItem>
              <DropdownItem
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

      {/* CWD subtitle row — only when NOT active, subtle */}
      {!isActive && (
        <li
          className="px-3 pb-0.5 -mt-0.5 mx-1"
          aria-hidden
        >
          <span className="text-[10px] text-[var(--color-ink-9)] font-mono truncate block">
            {cwdShort(session.cwd)}
          </span>
        </li>
      )}

      {renameOpen && (
        <RenameDialog session={session} onClose={() => setRenameOpen(false)} />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────

function DotsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3"  r="1.2" />
      <circle cx="8" cy="8"  r="1.2" />
      <circle cx="8" cy="13" r="1.2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16"
      fill="currentColor" stroke="none">
      <path d="M10 1L15 6L11 10L10.5 14L8.5 12L5 15.5L0.5 11L4 7.5L2 5.5L6 5L10 1Z" />
    </svg>
  );
}

function DropdownItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center h-7 px-3 text-[12px] text-[var(--color-ink-1)]
        cursor-pointer rounded-[var(--radius-xs)] mx-0.5
        hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-0)]
        transition-colors duration-[var(--duration-fast)]"
    >
      {children}
    </li>
  );
}
