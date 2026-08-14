/**
 * @module components/Sidebar/SessionRow
 * A single session entry in the sidebar list.
 *
 * - Click row → open session in terminal
 * - ⋮ button (visible on hover) → dropdown: Rename | Copy Session ID
 * - Rename → opens RenameDialog modal
 */
import type { ReactNode } from "react";
import { useEffect,useRef, useState } from "react";

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
  const [menuOpen,       setMenuOpen]  = useState(false);
  const [renameOpen,     setRenameOpen]= useState(false);
  const menuRef          = useRef<HTMLUListElement>(null);
  const isPinned         = pinnedIds.includes(session.id);

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

  const handleCopyId = () => {
    navigator.clipboard.writeText(session.id);
    setMenuOpen(false);
  };

  const handlePin = () => {
    togglePin(session.id);
    setMenuOpen(false);
  };

  return (
    <>
      <li
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter") onSelect(); }}
        className={cn(
          "relative group flex items-start justify-between gap-1",
          "mx-1 px-3 py-2 rounded-[var(--radius-sm)]",
          "cursor-pointer select-none",
          "transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "bg-[var(--color-accent-dim)] text-[var(--color-ink-0)]"
            : "hover:bg-[var(--color-bg-hover)] text-[var(--color-ink-1)]"
        )}
      >
        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {/* Title + time */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              {/* Pin badge */}
              {isPinned && (
                <span
                  title="Pinned"
                  className="mt-0.5 shrink-0 text-[var(--color-accent)]"
                >
                  <PinIcon filled />
                </span>
              )}
              <span className="text-[12.5px] font-medium leading-snug line-clamp-2">
                {session.title}
              </span>
            </div>
            <span className="text-[10px] shrink-0 mt-0.5 tabular-nums
              text-[var(--color-ink-7)]">
              {timeAgo(session.modified)}
            </span>
          </div>

          {/* CWD */}
          <span className="text-[10px] text-[var(--color-ink-7)] truncate font-mono">
            {cwdShort(session.cwd)}
          </span>
        </div>

        {/* ── Three-dot menu button ─────────────────────────────────── */}
        <div className="relative shrink-0 mt-0.5">
          <button
            aria-label="Session options"
            title="Options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={cn(
              "flex items-center justify-center w-5 h-5",
              "rounded-[var(--radius-xs)] transition-colors",
              "text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)]",
              "hover:bg-[var(--color-bg-2)]",
              // Only visible on row hover (or when menu is open)
              menuOpen
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            )}
          >
            <DotsIcon />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <ul
              ref={menuRef}
              role="menu"
              className={cn(
                "absolute right-0 top-full mt-1 z-50 min-w-40",
                "bg-[var(--color-bg-elev)] border border-[var(--color-border)]",
                "rounded-[var(--radius-md)] shadow-xl py-1",
                "text-xs text-[var(--color-ink-1)]"
              )}
            >
              <MenuItem
                onClick={() => { setMenuOpen(false); setRenameOpen(true); }}
              >
                Rename
              </MenuItem>
              <MenuItem onClick={handlePin}>
                <span className="flex items-center gap-2">
                  <PinIcon filled={isPinned} />
                  {isPinned ? "Unpin session" : "Pin session"}
                </span>
              </MenuItem>
              <MenuItem onClick={handleCopyId}>
                Copy session ID
              </MenuItem>
            </ul>
          )}
        </div>
      </li>

      {/* Rename dialog — rendered as portal-like sibling */}
      {renameOpen && (
        <RenameDialog
          session={session}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}

// ─── Icons + primitives ───────────────────────────────────────────────────

function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3"  r="1.3" />
      <circle cx="8" cy="8"  r="1.3" />
      <circle cx="8" cy="13" r="1.3" />
    </svg>
  );
}
/** Thumbtack pin icon. `filled` = accent-coloured solid, otherwise outlined. */
function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round">
      {/* Shaft */}
      <line x1="8" y1="10" x2="8" y2="15" />
      {/* Pin head */}
      <path d="M5 10h6V6l2-4H3l2 4v4Z" />
    </svg>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick:  () => void;
  children: ReactNode;
}) {
  return (
    <li
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="px-3 py-1.5 cursor-pointer transition-colors
        hover:bg-[var(--color-bg-hover)]"
    >
      {children}
    </li>
  );
}
