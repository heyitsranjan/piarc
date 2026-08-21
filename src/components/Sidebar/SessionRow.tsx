/**
 * @module components/Sidebar/SessionRow
 * Sidebar row for an agent-backed terminal tab (omp / codex / claude).
 *
 * Accepts a `Tab` directly — no OmpSession needed.
 * All display metadata (title, cwd, path, firstMessage, modifiedAt) lives on Tab.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

import { Menu } from "@tauri-apps/api/menu";
import { message } from "@tauri-apps/plugin-dialog";

import { CircleAlert, Loader2, StickyNote } from "lucide-react";

import { ItemIcon } from "@/components/shared/ItemIcon";

import { useSessionStore } from "@/store/sessions";
import { type Tab, useTerminalStore } from "@/store/terminal";

import { agentActivityLabel, isAgentWorking } from "@/lib/agent-activity";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionRowProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionRow({
  tab,
  isActive,
  onSelect,
  onRefresh,
}: SessionRowProps) {
  const { pinnedIds, togglePin, renameSession, removeSession } = useSessionStore();
  const { closeTab, updateTabTitle, toggleTabPin } = useTerminalStore();

  const isSpawning = tab.isLoading;
  const isWorking = isSpawning || isAgentWorking(tab.activity);
  const needsAttention =
    tab.activity.state === "waiting_approval" || tab.activity.state === "error";
  const activityLabel = agentActivityLabel(tab.activity);
  const showActivity = isWorking || needsAttention;

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isPinned = pinnedIds.includes(tab.id);
  const isPending = !tab.path;

  const openMenu = async (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const items = [
      ...(isPending ? [] : [{ text: "Refresh terminal", action: () => onRefresh() }]),
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
    ];
    const menu = await Menu.new({ items });
    await menu.popup();
  };

  const deleteHandler = async () => {
    setDeleteOpen(false);
    try {
      await closeTab(tab.id);
      if (tab.path) await removeSession(tab.path);
    } catch (reason) {
      await message(reason instanceof Error ? reason.message : String(reason), {
        title: "Could not delete session",
        kind: "error",
      });
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
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
        {tab.hasUnreadCompletion && !isActive && (
          <span
            className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
            aria-label="Unread completion"
          />
        )}
        <div className="absolute inset-y-0 left-2 right-8 flex min-w-0 items-center gap-2">
          <ItemIcon
            kind="session"
            agent={tab.agent ?? "omp"}
            size={13}
            className="shrink-0 text-[var(--color-ink-7)]"
          />
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
        </div>

        {tab.note?.trim() && (
          <StickyNote
            size={9}
            strokeWidth={2}
            className="absolute right-[26px] top-1/2 shrink-0 -translate-y-1/2 text-[var(--color-accent)]"
            aria-label="Has note"
          />
        )}

        <div className="absolute right-[7px] top-1/2 flex h-7 w-[18px] -translate-y-1/2 items-center justify-end">
          {isWorking ? (
            <Loader2
              size={14}
              strokeWidth={2}
              className="animate-spin text-[var(--color-accent)]"
              aria-label={isSpawning ? "Starting terminal" : activityLabel}
            />
          ) : needsAttention ? (
            <CircleAlert
              size={13}
              className={
                tab.activity.state === "error"
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-warn)]"
              }
              aria-label={activityLabel}
            />
          ) : (
            <span className="block w-[18px] text-right font-mono text-[7px] tabular-nums leading-[8px] text-[var(--color-ink-7)]">
              {timeAgo(tab.modifiedAt)}
            </span>
          )}
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDeleteDialog
          title="Delete session"
          message={`Delete "${tab.title}" from PiArc? This cannot be undone.`}
          onConfirm={() => void deleteHandler()}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={tab.title}
          subtitle={
            isPending ? "Pending session" : tab.path.split("/").slice(-2).join("/")
          }
          onRename={(title) =>
            isPending
              ? updateTabTitle(tab.id, title)
              : void renameSession(tab.path, title)
          }
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}
