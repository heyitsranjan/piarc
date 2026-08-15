/**
 * @module components/Sidebar/SessionRow
 * Single session row. Dropdown rendered as a portal to escape
 * overflow:hidden on the sidebar and sit above all other layers.
 */
import { message } from "@tauri-apps/plugin-dialog";
import {
  Copy,
  Loader2,
  MoreVertical,
  Pin,
  PinOff,
  SquarePen,
  Trash2,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

interface SessionRowProps {
  session: OmpSession;
  isActive: boolean;
  onSelect: () => void;
}

interface MenuPos {
  top: number;
  left: number;
}

export default function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const { pinnedIds, togglePin, renameSession, removeSession } = useSessionStore();
  const tabs = useTerminalStore((s) => s.tabs);
  const closeTab = useTerminalStore((state) => state.closeTab);
  const tab = tabs.find((t) => t.sessionId === session.id);
  /** PTY spawning → spinner */
  const isSpawning = tab?.isLoading === true;
  /** omp actively producing output → spinner */
  const isOutputting = tab?.isOutputting === true;
  /** terminal open, process idle (waiting for input) → green dot */
  const isIdle = !!tab && !tab.isLoading && !tab.isOutputting && tab.error === null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const isPinned = pinnedIds.includes(session.id);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
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

  const openMenu = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right - 176, // 176px = w-44 menu width
    });
    setMenuOpen(true);
  };

  const deleteSession = async () => {
    setDeleteOpen(false);

    try {
      if (tab) await closeTab(tab.id);
      await removeSession(session.path);
    } catch (reason) {
      await message(reason instanceof Error ? reason.message : String(reason), {
        title: "Could not delete session",
        kind: "error",
      });
    }
  };

  return (
    <>
      <li
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect();
        }}
        className={cn(
          "group relative mx-1.5 flex h-11 cursor-pointer select-none items-center gap-2",
          "rounded-[var(--radius-sm)] px-2 transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "bg-[var(--color-bg-active)] text-[var(--color-ink-0)]"
            : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-0)]"
        )}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2
              rounded-r-full bg-[var(--color-accent)]"
          />
        )}

        {/* Fixed status slot keeps every row title aligned. */}
        <span className="flex size-4 shrink-0 items-center justify-center">
          {(isSpawning || isOutputting) && (
            <Loader2
              size={14}
              strokeWidth={2}
              className="animate-spin text-[var(--color-accent)]"
              aria-label={isSpawning ? "Starting terminal" : "Agent running"}
            />
          )}
          {isIdle && (
            <span
              title="Terminal open"
              className="size-2 rounded-full bg-[var(--color-accent)] opacity-80"
            />
          )}
          {!isSpawning && !isOutputting && !isIdle && isPinned && (
            <Pin
              size={12}
              fill="currentColor"
              strokeWidth={0}
              className="text-[var(--color-accent)] opacity-70"
              aria-label="Pinned"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <span
            className="block truncate text-[13px] font-medium leading-[18px]"
            title={session.title}
          >
            {session.title}
          </span>
          <span
            className="block truncate font-mono text-[11px] leading-4
              text-[var(--color-ink-7)]"
            title={session.cwd}
          >
            {cwdShort(session.cwd)}
          </span>
        </div>

        {/* Timestamp and overflow share one fixed slot. */}
        <div className="relative flex h-7 w-14 shrink-0 items-center justify-end">
          <span
            className={cn(
              "text-[11px] tabular-nums leading-4 text-[var(--color-ink-7)]",
              "transition-opacity duration-[var(--duration-fast)]",
              menuOpen ? "opacity-0" : "group-hover:opacity-0"
            )}
          >
            {timeAgo(session.modified)}
          </span>
          <button
            ref={buttonRef}
            type="button"
            aria-label="Session options"
            aria-expanded={menuOpen}
            onClick={openMenu}
            className={cn(
              "absolute right-0 flex size-7 items-center justify-center",
              "rounded-[var(--radius-sm)] text-[var(--color-ink-7)]",
              "transition-colors hover:bg-[var(--color-bg-hi)] hover:text-[var(--color-ink-0)]",
              menuOpen
                ? "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)] opacity-100"
                : "opacity-0 group-hover:opacity-100"
            )}
          >
            <MoreVertical size={16} strokeWidth={1.8} />
          </button>
        </div>
      </li>

      {/* Dropdown — portal so it escapes sidebar overflow:hidden */}
      {menuOpen &&
        createPortal(
          <ul
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 9999,
              minWidth: 176,
            }}
            className="bg-[var(--color-bg-2)] border border-[var(--color-border)]
            rounded-[var(--radius-md)]
            shadow-[0_8px_32px_rgba(0,0,0,0.6)]
            py-0.5 overflow-hidden"
          >
            <DropdownItem
              icon={<SquarePen size={15} strokeWidth={1.8} />}
              onClick={() => {
                setMenuOpen(false);
                setRenameOpen(true);
              }}
            >
              Rename
            </DropdownItem>
            <DropdownItem
              icon={
                isPinned ? (
                  <PinOff size={15} strokeWidth={1.8} />
                ) : (
                  <Pin size={15} strokeWidth={1.8} />
                )
              }
              onClick={() => {
                togglePin(session.id);
                setMenuOpen(false);
              }}
            >
              {isPinned ? "Unpin" : "Pin to top"}
            </DropdownItem>
            <DropdownItem
              icon={<Copy size={15} strokeWidth={1.8} />}
              onClick={() => {
                navigator.clipboard.writeText(session.id);
                setMenuOpen(false);
              }}
            >
              Copy session ID
            </DropdownItem>
            <DropdownItem
              danger
              icon={<Trash2 size={15} strokeWidth={1.8} />}
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              Delete session
            </DropdownItem>
          </ul>,
          document.body
        )}

      {deleteOpen && (
        <ConfirmDeleteDialog
          title="Delete session"
          message={`Delete "${session.title}" from Oh My Pi? This cannot be undone.`}
          onConfirm={() => void deleteSession()}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={session.title}
          subtitle={session.path.split("/").slice(-2).join("/")}
          onRename={(title) => renameSession(session.path, title)}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}

function DropdownItem({
  icon,
  onClick,
  children,
  danger = false,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <li
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "mx-0.5 flex h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)]",
        "px-3 text-[13px] transition-colors duration-[var(--duration-fast)]",
        "hover:bg-[var(--color-bg-hover)]",
        danger
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-ink-1)] hover:text-[var(--color-ink-0)]"
      )}
    >
      <span className={danger ? undefined : "text-[var(--color-ink-7)]"}>{icon}</span>
      {children}
    </li>
  );
}
