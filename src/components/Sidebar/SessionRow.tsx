/**
 * @module components/Sidebar/SessionRow
 * Single session row. Dropdown rendered as a portal to escape
 * overflow:hidden on the sidebar and sit above all other layers.
 */
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Copy, Loader2, MoreVertical, Pin, PinOff, SquarePen } from "lucide-react";

import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

import RenameDialog from "./RenameDialog";

interface SessionRowProps {
  session:  OmpSession;
  isActive: boolean;
  onSelect: () => void;
}

interface MenuPos { top: number; left: number; }

export default function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const { pinnedIds, togglePin } = useSessionStore();
  const tabs    = useTerminalStore((s) => s.tabs);
  const tab     = tabs.find((t) => t.sessionId === session.id);
  /** PTY is being spawned — show spinner */
  const isSpawning = tab?.isLoading === true;
  /** PTY is live with no error — show pulse dot */
  const isRunning  = !!tab && !tab.isLoading && tab.error === null;

  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuPos,    setMenuPos]    = useState<MenuPos>({ top: 0, left: 0 });
  const [renameOpen, setRenameOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef   = useRef<HTMLUListElement>(null);
  const isPinned  = pinnedIds.includes(session.id);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current  && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on scroll (portal position would drift)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top:  rect.bottom + 4,
      left: rect.right - 176,  // 176px = w-44 menu width
    });
    setMenuOpen(true);
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
          "group relative flex items-center gap-1.5",
          "mx-1.5 px-2 rounded-[var(--radius-sm)]",
          "py-[6px] cursor-pointer select-none",
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

        {/* Pin badge */}
        {isPinned && (
          <span className="shrink-0 text-[var(--color-accent)] opacity-60 ml-0.5">
            <Pin size={9} fill="currentColor" strokeWidth={0} />
          </span>
        )}

        {/* Run-state indicator — spawning spinner OR live pulse dot */}
        {isSpawning && (
          <span className="shrink-0 text-[var(--color-ink-7)]" title="Starting…">
            <Loader2 size={10} strokeWidth={2} className="animate-spin" />
          </span>
        )}
        {isRunning && !isSpawning && (
          <span
            title="Terminal running"
            className="shrink-0 w-[7px] h-[7px] rounded-full
              bg-[var(--color-accent)] animate-pulse"
          />
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[12.5px] font-medium truncate leading-snug">
              {session.title}
            </span>
            {/* Timestamp hides on hover or when menu is open */}
            <span className={cn(
              "shrink-0 text-[10.5px] tabular-nums text-[var(--color-ink-9)] leading-none",
              "transition-opacity duration-[var(--duration-fast)]",
              menuOpen ? "opacity-0" : "group-hover:opacity-0"
            )}>
              {timeAgo(session.modified)}
            </span>
          </div>
          <span className="block text-[10.5px] text-[var(--color-ink-9)]
            font-mono truncate mt-[2px] leading-none">
            {cwdShort(session.cwd)}
          </span>
        </div>

        {/* ⋮ button */}
        <div className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2",
          "transition-opacity duration-[var(--duration-fast)]",
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button
            ref={buttonRef}
            aria-label="Session options"
            aria-expanded={menuOpen}
            onClick={openMenu}
            className={cn(
              "flex items-center justify-center w-[20px] h-[20px]",
              "rounded-[var(--radius-xs)]",
              "text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)]",
              "hover:bg-[var(--color-bg-hi)] transition-colors",
              menuOpen && "bg-[var(--color-bg-hi)] text-[var(--color-ink-1)]"
            )}
          >
            <MoreVertical size={12} strokeWidth={2} />
          </button>
        </div>
      </li>

      {/* Dropdown — portal so it escapes sidebar overflow:hidden */}
      {menuOpen && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top:      menuPos.top,
            left:     menuPos.left,
            zIndex:   9999,
            minWidth: 176,
          }}
          className="bg-[var(--color-bg-2)] border border-[var(--color-border)]
            rounded-[var(--radius-md)]
            shadow-[0_8px_32px_rgba(0,0,0,0.6)]
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
        </ul>,
        document.body
      )}

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
