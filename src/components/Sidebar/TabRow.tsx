/**
 * @module components/Sidebar/TabRow
 * Unified sidebar row for every tab variant: agent sessions, plain terminals, and notes.
 *
 * One component, one React key (`tab.id`), zero remounts on type transitions.
 * Rendering branches purely on `tab.kind` + `tab.agent` — no separate SessionRow
 * or TerminalRow needed.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

import { Menu } from "@tauri-apps/api/menu";
import { message } from "@tauri-apps/plugin-dialog";

import { Archive, CircleAlert, FileText, Loader2, StickyNote, Zap } from "lucide-react";

import { ItemIcon } from "@/components/shared/ItemIcon";

import { useSessionStore } from "@/store/sessions";
import {
  type ClaudeTab,
  type CodexTab,
  type Tab,
  isAgentTab,
  isNoteTab,
  isOmpTab,
  useTerminalStore,
} from "@/store/terminal";

import { agentActivityLabel, isAgentWorking } from "@/lib/agent-activity";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TabRowProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  /** Agent tabs only — refresh (kill + respawn) the terminal. */
  onRefresh?: () => void;
  /** Non-agent tabs only — called after the close confirmation. */
  onDelete?: () => void;
  /** Non-agent tabs only — update title without a session rename. */
  onRename?: (title: string) => void;
  onTogglePin?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notePreview(content: string): string {
  const snippet = content.replace(/\s+/g, " ").trim().slice(0, 42);
  return snippet || "Empty note";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TabRow({
  tab,
  isActive,
  onSelect,
  onRefresh,
  onDelete,
  onRename,
  onTogglePin,
}: TabRowProps) {
  const { pinnedIds, togglePin, renameSession, removeSession } = useSessionStore();
  const { closeTab, updateTabTitle, toggleTabPin } = useTerminalStore();

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Agent-specific display ─────────────────────────────────────────────
  const isAgent = isAgentTab(tab);
  const isSpawning = tab.isLoading;
  const isWorking = isAgent && (isSpawning || isAgentWorking(tab.activity));
  const needsAttention =
    isAgent &&
    (tab.activity.state === "waiting_approval" || tab.activity.state === "error");
  const activityLabel = isAgent ? agentActivityLabel(tab.activity) : "";
  const showActivity = isWorking || needsAttention;

  // For OMP: path used for rename/delete ops.
  const isPending = isAgent && (!isOmpTab(tab) || !tab.path);
  const isPinned = pinnedIds.includes(tab.id);

  // ── Context menu ──────────────────────────────────────────────────────
  const openMenu = async (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const items = isAgent
      ? [
          ...(isPending
            ? []
            : [{ text: "Refresh terminal", action: () => onRefresh?.() }]),
          { text: "Rename", action: () => setRenameOpen(true) },
          {
            text: isPinned ? "Unpin" : "Pin to top",
            action: () => {
              togglePin(tab.id);
              toggleTabPin(tab.id);
            },
          },
          ...(isPending
            ? []
            : [
                {
                  text: "Copy session ID",
                  action: () => void navigator.clipboard.writeText(tab.sessionId),
                },
              ]),
          { text: "Delete session", action: () => setDeleteOpen(true) },
        ]
      : [
          { text: "Rename", action: () => setRenameOpen(true) },
          {
            text: tab.isPinned ? "Unpin" : "Pin to top",
            action: () => onTogglePin?.(),
          },
          {
            text: isNoteTab(tab) ? "Delete note" : "Delete terminal",
            action: () => setDeleteOpen(true),
          },
        ];

    const menu = await Menu.new({ items });
    await menu.popup();
  };

  // ── Delete handlers ───────────────────────────────────────────────────
  const handleDeleteAgent = async () => {
    setDeleteOpen(false);
    try {
      await closeTab(tab.id);
      if (isOmpTab(tab) && tab.path) await removeSession(tab.path);
    } catch (reason) {
      await message(reason instanceof Error ? reason.message : String(reason), {
        title: "Could not delete session",
        kind: "error",
      });
    }
  };

  const handleDeleteOther = () => {
    setDeleteOpen(false);
    onDelete?.();
  };

  // ── Subtitle ──────────────────────────────────────────────────────────
  const subtitle = isAgent
    ? showActivity
      ? activityLabel
      : cwdShort(tab.cwd)
    : isNoteTab(tab)
      ? notePreview(tab.content)
      : cwdShort(tab.cwd);

  const subtitleTitle = isAgent
    ? showActivity
      ? activityLabel
      : tab.cwd
    : isNoteTab(tab)
      ? notePreview(tab.content)
      : tab.cwd;

  const subtitleClass =
    isAgent && showActivity
      ? tab.activity.state === "error"
        ? "text-[var(--color-danger)]"
        : tab.activity.state === "waiting_approval"
          ? "text-[var(--color-warn)]"
          : "text-[var(--color-accent)]"
      : "text-[var(--color-ink-7)]";

  // ── Right badge — state-aware for agent tabs ───────────────────────────
  const activityState = isAgent ? tab.activity.state : undefined;

  const rightBadge = (() => {
    if (isAgent && isWorking) {
      switch (activityState) {
        case "tool":
        case "retrying":
          return (
            <Zap
              size={13}
              strokeWidth={2}
              className="animate-pulse text-amber-400"
              aria-label={activityLabel}
            />
          );
        case "compacting":
          return (
            <Archive
              size={13}
              strokeWidth={2}
              className="animate-pulse text-[var(--color-ink-5)]"
              aria-label={activityLabel}
            />
          );
        case "starting":
          return (
            <Loader2
              size={14}
              strokeWidth={2}
              className="animate-spin text-[var(--color-ink-7)]"
              aria-label="Starting terminal"
            />
          );
        default:
          // thinking / responding
          return (
            <Loader2
              size={14}
              strokeWidth={2}
              className="animate-spin text-[var(--color-accent)]"
              aria-label={activityLabel}
            />
          );
      }
    }
    if (isAgent && needsAttention) {
      return (
        <CircleAlert
          size={13}
          className={
            tab.activity.state === "error"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-warn)]"
          }
          aria-label={activityLabel}
        />
      );
    }
    return (
      <span className="block w-[18px] text-right font-mono text-[7px] tabular-nums leading-[8px] text-[var(--color-ink-7)]">
        {timeAgo(tab.modifiedAt)}
      </span>
    );
  })();

  // ── Rename dialog props ───────────────────────────────────────────────
  const renameSubtitle = (() => {
    if (isAgentTab(tab)) {
      if (isPending) return "Pending session";
      if (isOmpTab(tab)) return tab.path.split("/").slice(-2).join("/");
      return (tab as CodexTab | ClaudeTab).sessionId;
    }
    if (isNoteTab(tab)) return timeAgo(tab.modifiedAt);
    return cwdShort(tab.cwd);
  })();

  const handleRename = (title: string) => {
    if (isAgent) {
      if (!isPending && isOmpTab(tab) && tab.path) {
        void renameSession(tab.path, title);
      } else {
        updateTabTitle(tab.id, title);
      }
    } else {
      onRename?.(title);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onContextMenu={(event) => void openMenu(event)}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect();
        }}
        className={cn(
          "group relative mx-1.5 h-12",
          "rounded-[4px] border border-transparent transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "arc-row-active text-[var(--color-ink-1)]"
            : "text-[var(--color-ink-1)] hover:text-[var(--color-ink-0)]"
        )}
      >
        {/* Unread completion dot — agent tabs only */}
        {isAgent && tab.hasUnreadCompletion && !isActive && (
          <span
            className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
            aria-label="Unread completion"
          />
        )}

        <div className="absolute inset-y-0 left-2 right-8 flex min-w-0 items-center gap-2">
          {/* Icon */}
          {isNoteTab(tab) ? (
            <FileText
              size={13}
              strokeWidth={1.7}
              className="shrink-0 text-[var(--color-ink-7)]"
            />
          ) : (
            <ItemIcon
              kind={isAgent ? "session" : "terminal"}
              agent={isAgent ? tab.agent : null}
              size={13}
              className="shrink-0 text-[var(--color-ink-7)]"
              activityState={isOmpTab(tab) && isWorking ? activityState : undefined}
            />
          )}

          {/* Title + subtitle */}
          <div className="flex min-w-0 flex-col justify-center">
            <span
              className={cn(
                "block truncate font-mono text-[10px] font-semibold leading-[12px]",
                isActive && "text-[var(--color-accent)]"
              )}
              title={tab.title}
            >
              {tab.title}
            </span>
            <span
              className={cn(
                "mt-1 block truncate font-mono text-[8px] leading-[9px]",
                subtitleClass
              )}
              title={subtitleTitle}
            >
              {subtitle}
            </span>
          </div>
        </div>

        {/* Sticky note badge */}
        {tab.note?.trim() && (
          <StickyNote
            size={9}
            strokeWidth={2}
            className="absolute right-[26px] top-1/2 shrink-0 -translate-y-1/2 text-[var(--color-accent)]"
            aria-label="Has note"
          />
        )}

        {/* Right badge: spinner / alert / time */}
        <div className="absolute right-[7px] top-1/2 flex h-7 w-[18px] -translate-y-1/2 items-center justify-end">
          {rightBadge}
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDeleteDialog
          title={
            isAgent
              ? "Delete session"
              : isNoteTab(tab)
                ? "Delete note"
                : "Delete terminal"
          }
          message={
            isAgent
              ? `Delete "${tab.title}" from PiArc? This cannot be undone.`
              : isNoteTab(tab)
                ? `Delete "${tab.title}"? This note cannot be recovered.`
                : `Delete "${tab.title}"? Any running process will be stopped.`
          }
          onConfirm={() => (isAgent ? void handleDeleteAgent() : handleDeleteOther())}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={tab.title}
          subtitle={renameSubtitle}
          onRename={handleRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}
