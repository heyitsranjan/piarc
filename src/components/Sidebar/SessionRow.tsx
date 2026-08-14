import type { ReactNode } from "react";
/**
 * @module components/Sidebar/SessionRow
 * A single session entry in the sidebar list.
 *
 * Displays: title, relative timestamp, shortened cwd.
 * Supports: click to open, pin indicator, right-click context menu.
 */
import { useState } from "react";

import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";

interface SessionRowProps {
  session: OmpSession;
  /** Whether this session's terminal is currently visible. */
  isActive: boolean;
  /** Called when the user clicks to open/switch to this session. */
  onSelect: () => void;
}

/** One row in the session list. Clicking it opens/resumes the session. */
export default function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const { pinnedIds, togglePin, removeSession } = useSessionStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPinned = pinnedIds.includes(session.id);

  return (
    <li
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      className={cn(
        "relative group flex flex-col gap-0.5",
        "mx-1 px-3 py-2 rounded-[var(--radius-sm)]",
        "cursor-pointer select-none",
        "transition-colors duration-[var(--duration-fast)]",
        isActive
          ? "bg-[var(--color-accent-dim)] text-[var(--color-ink-0)]"
          : "hover:bg-[var(--color-bg-hover)] text-[var(--color-ink-1)]"
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium leading-snug line-clamp-2 flex-1">
          {isPinned && (
            <span className="text-[var(--color-accent)] mr-1" aria-hidden>
              ·
            </span>
          )}
          {session.title}
        </span>
        <span className="text-[10px] shrink-0 mt-0.5 tabular-nums text-[var(--color-ink-7)]">
          {timeAgo(session.modified)}
        </span>
      </div>

      {/* CWD subtitle */}
      <span className="text-[10px] text-[var(--color-ink-7)] truncate font-[var(--font-mono)]">
        {cwdShort(session.cwd)}
      </span>

      {/* Context menu */}
      {menuOpen && (
        <ContextMenu
          isPinned={isPinned}
          onPin={() => {
            togglePin(session.id);
            setMenuOpen(false);
          }}
          onCopyResume={() => {
            navigator.clipboard.writeText(`omp --resume ${session.id}`);
            setMenuOpen(false);
          }}
          onDelete={async () => {
            setMenuOpen(false);
            await removeSession(session.path);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </li>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────

interface ContextMenuProps {
  isPinned: boolean;
  onPin: () => void;
  onCopyResume: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({
  isPinned,
  onPin,
  onCopyResume,
  onDelete,
  onClose,
}: ContextMenuProps) {
  return (
    <>
      {/* Invisible backdrop to capture outside clicks */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <ul
        role="menu"
        className={cn(
          "absolute left-full top-0 ml-1 z-50 min-w-44",
          "bg-[var(--color-bg-elev)] border border-[var(--color-border)]",
          "rounded-[var(--radius-md)] shadow-xl py-1",
          "text-xs text-[var(--color-ink-1)]"
        )}
      >
        <ContextItem onClick={onPin}>
          {isPinned ? "Unpin session" : "Pin session"}
        </ContextItem>
        <ContextItem onClick={onCopyResume}>Copy resume command</ContextItem>
        <div className="my-1 mx-2 border-t border-[var(--color-border-2)]" />
        <ContextItem onClick={onDelete} danger>
          Delete session
        </ContextItem>
      </ul>
    </>
  );
}

function ContextItem({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      role="menuitem"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 cursor-pointer transition-colors",
        danger
          ? "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          : "hover:bg-[var(--color-bg-hover)]"
      )}
    >
      {children}
    </li>
  );
}
