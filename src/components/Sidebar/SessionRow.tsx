/**
 * @module components/Sidebar/SessionRow
 * One session entry with a native macOS context menu.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

import { Menu } from "@tauri-apps/api/menu";
import { message } from "@tauri-apps/plugin-dialog";

import { CircleAlert, Loader2 } from "lucide-react";

import { ItemIcon } from "@/components/shared/ItemIcon";

import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";

import { agentActivityLabel, isAgentWorking } from "@/lib/agent-activity";
import type { OmpSession } from "@/lib/session";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

interface SessionRowProps {
  session: OmpSession;
  isActive: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}

export default function SessionRow({
  session,
  isActive,
  onSelect,
  onRefresh,
}: SessionRowProps) {
  const { pinnedIds, togglePin, renameSession, removeSession } = useSessionStore();
  const tabs = useTerminalStore((s) => s.tabs);
  const closeTab = useTerminalStore((state) => state.closeTab);
  const updateTabTitle = useTerminalStore((state) => state.updateTabTitle);
  const tab = tabs.find((t) => t.sessionId === session.id || t.id === session.id);
  const isSpawning = tab?.isLoading === true;
  const isWorking = !!tab && (isSpawning || isAgentWorking(tab.activity));
  const needsAttention =
    tab?.activity.state === "waiting_approval" || tab?.activity.state === "error";
  const activityLabel = tab ? agentActivityLabel(tab.activity) : "";

  const showActivity = isWorking || needsAttention;
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isPinned = pinnedIds.includes(session.id);

  const isPending = !session.path;
  const openMenu = async (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const items = [
      ...(isPending ? [] : [{ text: "Refresh terminal", action: () => onRefresh() }]),
      { text: "Rename", action: () => setRenameOpen(true) },
      {
        text: isPinned ? "Unpin" : "Pin to top",
        action: () => togglePin(session.id),
      },
      ...(isPending
        ? []
        : [
            {
              text: "Copy session ID",
              action: () => void navigator.clipboard.writeText(session.id),
            },
          ]),
      { text: "Delete session", action: () => setDeleteOpen(true) },
    ];
    const menu = await Menu.new({ items });
    await menu.popup();
  };

  const deleteSession = async () => {
    setDeleteOpen(false);
    try {
      if (tab) await closeTab(tab.id);
      // Only remove from disk if the session has a path (not pending).
      if (session.path) await removeSession(session.path);
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
          "group relative mx-1.5 h-12 select-none",
          "rounded-[4px] border border-transparent transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "arc-row-active text-[var(--color-ink-1)]"
            : "text-[var(--color-ink-1)] hover:text-[var(--color-ink-0)]"
        )}
      >
        <div className="absolute inset-y-0 left-2 right-8 flex min-w-0 items-center gap-2">
          <ItemIcon
            kind="session"
            size={13}
            className="shrink-0 text-[var(--color-ink-7)]"
          />
          <div className="flex min-w-0 flex-col justify-center">
            <span
              className={cn(
                "block truncate font-mono text-[10px] font-semibold leading-[12px]",
                isActive && "text-[var(--color-accent)]"
              )}
              title={session.title}
            >
              {session.title}
            </span>
            <span
              className={cn(
                "mt-1 block truncate font-mono text-[8px] leading-[9px]",
                showActivity
                  ? tab?.activity.state === "error"
                    ? "text-[var(--color-danger)]"
                    : tab?.activity.state === "waiting_approval"
                      ? "text-[var(--color-warn)]"
                      : "text-[var(--color-accent)]"
                  : "text-[var(--color-ink-7)]"
              )}
              title={showActivity ? activityLabel : session.cwd}
            >
              {showActivity ? activityLabel : cwdShort(session.cwd)}
            </span>
          </div>
        </div>

        {/* Timestamp and overflow share one fixed slot. */}
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
                tab?.activity.state === "error"
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-warn)]"
              }
              aria-label={activityLabel}
            />
          ) : (
            <span className="block w-[18px] text-right font-mono text-[7px] tabular-nums leading-[8px] text-[var(--color-ink-7)]">
              {timeAgo(session.modified)}
            </span>
          )}
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDeleteDialog
          title="Delete session"
          message={`Delete "${session.title}" from PiArc? This cannot be undone.`}
          onConfirm={() => void deleteSession()}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={session.title}
          subtitle={
            isPending ? "Pending session" : session.path.split("/").slice(-2).join("/")
          }
          onRename={(title) =>
            isPending
              ? updateTabTitle(session.id, title)
              : renameSession(session.path, title)
          }
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}
