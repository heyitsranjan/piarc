/**
 * @module components/Sidebar/SessionRow
 * A single session entry in the sidebar list.
 *
 * - Click → open session in terminal
 * - Double-click title → inline rename
 * - Right-click → context menu (rename, pin, copy, delete)
 */
import type { ReactNode } from "react";
import { useEffect,useRef, useState } from "react";

import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";

interface SessionRowProps {
  session:  OmpSession;
  isActive: boolean;
  onSelect: () => void;
}

export default function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  const { pinnedIds, togglePin, removeSession, renameSession } = useSessionStore();
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPinned = pinnedIds.includes(session.id);

  // Keep draft in sync if the session title changes externally
  useEffect(() => { setDraft(session.title); }, [session.title]);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit  = () => { setDraft(session.title); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(session.title); };

  const commitEdit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === session.title) return;
    await renameSession(session.path, trimmed);
  };

  return (
    <li
      role="button"
      tabIndex={0}
      aria-selected={isActive}
      onClick={editing ? undefined : onSelect}
      onKeyDown={(e) => { if (!editing && e.key === "Enter") onSelect(); }}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
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
      {/* ── Title row ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          /* Inline rename input */
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              e.stopPropagation(); // prevent sidebar click handlers
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex-1 text-[12.5px] font-medium leading-snug",
              "bg-[var(--color-bg-elev)] text-[var(--color-ink-0)]",
              "border border-[var(--color-accent)] rounded-[var(--radius-xs)]",
              "px-1.5 py-0.5 outline-none min-w-0",
              "focus:ring-1 focus:ring-[var(--color-accent)]"
            )}
          />
        ) : (
          /* Display title — double-click to edit */
          <span
            className="text-[12.5px] font-medium leading-snug line-clamp-2 flex-1"
            onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
            title="Double-click to rename"
          >
            {isPinned && (
              <span className="text-[var(--color-accent)] mr-1" aria-hidden>·</span>
            )}
            {session.title}
          </span>
        )}

        {!editing && (
          <span className="text-[10px] shrink-0 mt-0.5 tabular-nums text-[var(--color-ink-7)]">
            {timeAgo(session.modified)}
          </span>
        )}
      </div>

      {/* ── CWD ──────────────────────────────────────────────────────── */}
      {!editing && (
        <span className="text-[10px] text-[var(--color-ink-7)] truncate font-mono">
          {cwdShort(session.cwd)}
        </span>
      )}

      {/* ── Context menu ─────────────────────────────────────────────── */}
      {menuOpen && (
        <ContextMenu
          isPinned={isPinned}
          onRename={() => { setMenuOpen(false); startEdit(); }}
          onPin={() => { togglePin(session.id); setMenuOpen(false); }}
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
  isPinned:     boolean;
  onRename:     () => void;
  onPin:        () => void;
  onCopyResume: () => void;
  onDelete:     () => void;
  onClose:      () => void;
}

function ContextMenu({
  isPinned, onRename, onPin, onCopyResume, onDelete, onClose,
}: ContextMenuProps) {
  return (
    <>
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
        <ContextItem onClick={onRename}>Rename session</ContextItem>
        <ContextItem onClick={onPin}>
          {isPinned ? "Unpin session" : "Pin session"}
        </ContextItem>
        <ContextItem onClick={onCopyResume}>Copy resume command</ContextItem>
        <div className="my-1 mx-2 border-t border-[var(--color-border-2)]" />
        <ContextItem onClick={onDelete} danger>Delete session</ContextItem>
      </ul>
    </>
  );
}

function ContextItem({
  onClick,
  danger = false,
  children,
}: {
  onClick:  () => void;
  danger?:  boolean;
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
