import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import {
  CircleAlert,
  Loader2,
  MoreVertical,
  Pin,
  PinOff,
  SquarePen,
  Trash2,
} from "lucide-react";

import type { Tab } from "@/store/terminal";

import { agentActivityLabel, isAgentWorking } from "@/lib/agent-activity";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

interface TerminalRowProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
}

export default function TerminalRow({
  tab,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
}: TerminalRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: Event) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  const openMenu = (event: ReactMouseEvent) => {
    event.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    setMenuOpen(true);
  };

  const deleteTerminal = () => {
    setDeleteOpen(false);
    onDelete();
  };

  const isWorking = tab.isLoading || isAgentWorking(tab.activity);
  const needsAttention =
    tab.activity.state === "waiting_approval" || tab.activity.state === "error";
  const activityLabel = agentActivityLabel(tab.activity);

  const showActivity = isWorking || needsAttention;
  return (
    <>
      <li
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onClick={onSelect}
        onKeyDown={(event) => event.key === "Enter" && onSelect()}
        className={cn(
          "group relative mx-1.5 flex h-11 cursor-pointer select-none items-center gap-2",
          "rounded-[var(--radius-sm)] px-2 transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "bg-[var(--color-bg-active)] text-[var(--color-ink-0)]"
            : "text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-0)]"
        )}
      >
        {isActive && (
          <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[var(--color-accent)]" />
        )}

        <div className="min-w-0 flex-1">
          <span
            className="block truncate text-[13px] font-medium leading-[18px]"
            title={tab.title}
          >
            {tab.title}
          </span>
          <span
            className={cn(
              "block truncate font-mono text-[11px] leading-4",
              showActivity
                ? tab.activity.state === "error"
                  ? "text-[var(--color-danger)]"
                  : tab.activity.state === "waiting_approval"
                    ? "text-[var(--color-warn)]"
                    : "text-[var(--color-accent)]"
                : "text-[var(--color-ink-7)]"
            )}
            title={showActivity ? activityLabel : tab.cwd}
          >
            {showActivity ? activityLabel : cwdShort(tab.cwd)}
          </span>
        </div>

        <div className="relative flex h-7 w-14 shrink-0 items-center justify-end">
          {isWorking ? (
            <Loader2
              size={14}
              strokeWidth={2}
              className={cn(
                "animate-spin text-[var(--color-accent)] transition-opacity",
                menuOpen ? "opacity-0" : "group-hover:opacity-0"
              )}
              aria-label={tab.isLoading ? "Starting terminal" : activityLabel}
            />
          ) : needsAttention ? (
            <CircleAlert
              size={13}
              className={cn(
                tab.activity.state === "error"
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-warn)]",
                "transition-opacity",
                menuOpen ? "opacity-0" : "group-hover:opacity-0"
              )}
              aria-label={activityLabel}
            />
          ) : (
            <span
              className={cn(
                "text-[11px] tabular-nums leading-4 text-[var(--color-ink-7)]",
                "transition-opacity duration-[var(--duration-fast)]",
                menuOpen ? "opacity-0" : "group-hover:opacity-0"
              )}
            >
              {timeAgo(tab.createdAt)}
            </span>
          )}
          <button
            ref={buttonRef}
            type="button"
            aria-label="Terminal options"
            aria-expanded={menuOpen}
            onClick={openMenu}
            className={cn(
              "absolute right-0 flex size-7 items-center justify-center rounded-[var(--radius-sm)]",
              "text-[var(--color-ink-7)] transition-colors hover:bg-[var(--color-bg-hi)] hover:text-[var(--color-ink-0)]",
              menuOpen
                ? "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)] opacity-100"
                : "opacity-0 group-hover:opacity-100"
            )}
          >
            <MoreVertical size={16} strokeWidth={1.8} />
          </button>
        </div>
      </li>

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
            }}
            className="w-44 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]
              bg-[var(--color-bg-2)] py-0.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <MenuItem
              icon={<SquarePen size={15} strokeWidth={1.8} />}
              onClick={() => {
                setMenuOpen(false);
                setRenameOpen(true);
              }}
            >
              Rename
            </MenuItem>
            <MenuItem
              icon={
                tab.isPinned ? (
                  <PinOff size={15} strokeWidth={1.8} />
                ) : (
                  <Pin size={15} strokeWidth={1.8} />
                )
              }
              onClick={() => {
                onTogglePin();
                setMenuOpen(false);
              }}
            >
              {tab.isPinned ? "Unpin" : "Pin to top"}
            </MenuItem>
            <MenuItem
              danger
              icon={<Trash2 size={15} strokeWidth={1.8} />}
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              Delete terminal
            </MenuItem>
          </ul>,
          document.body
        )}

      {deleteOpen && (
        <ConfirmDeleteDialog
          title="Delete terminal"
          message={`Delete "${tab.title}"? Any running process in this terminal will be stopped.`}
          onConfirm={deleteTerminal}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={tab.title}
          subtitle={cwdShort(tab.cwd)}
          onRename={onRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}

function MenuItem({
  icon,
  children,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <li
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "mx-0.5 flex h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-3",
        "text-[13px] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-bg-hover)]",
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
