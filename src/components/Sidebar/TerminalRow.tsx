import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

import { Menu } from "@tauri-apps/api/menu";

import { CircleAlert, FileText, Loader2 } from "lucide-react";

import { ItemIcon } from "@/components/shared/ItemIcon";

import type { Tab } from "@/store/terminal";

import { agentActivityLabel, isAgentWorking } from "@/lib/agent-activity";
import { cwdShort, timeAgo } from "@/lib/session";
import { cn } from "@/lib/utils";

import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RenameDialog from "./RenameDialog";

function notePreview(tab: Tab): string {
  const snippet = tab.content.replace(/\s+/g, " ").trim().slice(0, 36);
  return snippet ? `${snippet} · ${timeAgo(tab.createdAt)}` : timeAgo(tab.createdAt);
}

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
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openMenu = async (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = await Menu.new({
      items: [
        { text: "Rename", action: () => setRenameOpen(true) },
        {
          text: tab.isPinned ? "Unpin" : "Pin to top",
          action: onTogglePin,
        },
        {
          text: tab.kind === "note" ? "Delete note" : "Delete terminal",
          action: () => setDeleteOpen(true),
        },
      ],
    });
    await menu.popup();
  };

  const deleteTerminal = () => {
    setDeleteOpen(false);
    onDelete();
  };

  const isWorking =
    tab.kind !== "note" && (tab.isLoading || isAgentWorking(tab.activity));
  const needsAttention =
    tab.kind !== "note" &&
    (tab.activity.state === "waiting_approval" || tab.activity.state === "error");
  const activityLabel = agentActivityLabel(tab.activity);

  const showActivity = isWorking || needsAttention;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-selected={isActive}
        onContextMenu={(event) => void openMenu(event)}
        onClick={onSelect}
        onKeyDown={(event) => event.key === "Enter" && onSelect()}
        className={cn(
          "group relative mx-1.5 h-12 select-none",
          "rounded-[4px] border border-transparent transition-colors duration-[var(--duration-fast)]",
          isActive
            ? "arc-row-active text-[var(--color-ink-1)]"
            : "text-[var(--color-ink-1)] hover:text-[var(--color-ink-0)]"
        )}
      >
        <div className="absolute inset-y-0 left-2 right-8 flex min-w-0 items-center gap-2">
          {tab.kind === "note" ? (
            <FileText
              size={13}
              strokeWidth={1.7}
              className="shrink-0 text-[var(--color-ink-7)]"
            />
          ) : (
            <ItemIcon
              kind="terminal"
              size={13}
              className="shrink-0 text-[var(--color-ink-7)]"
            />
          )}
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
              title={
                showActivity
                  ? activityLabel
                  : tab.kind === "note"
                    ? notePreview(tab)
                    : tab.cwd
              }
            >
              {showActivity
                ? activityLabel
                : tab.kind === "note"
                  ? notePreview(tab)
                  : cwdShort(tab.cwd)}
            </span>
          </div>
        </div>

        <div className="absolute right-[7px] top-1/2 flex h-7 w-[18px] -translate-y-1/2 items-center justify-end">
          {isWorking ? (
            <Loader2
              size={14}
              strokeWidth={2}
              className="animate-spin text-[var(--color-accent)]"
              aria-label={tab.isLoading ? "Starting terminal" : activityLabel}
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
              {timeAgo(tab.createdAt)}
            </span>
          )}
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDeleteDialog
          title={tab.kind === "note" ? "Delete note" : "Delete terminal"}
          message={
            tab.kind === "note"
              ? `Delete "${tab.title}"? This note cannot be recovered.`
              : `Delete "${tab.title}"? Any running process in this terminal will be stopped.`
          }
          onConfirm={deleteTerminal}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {renameOpen && (
        <RenameDialog
          title={tab.title}
          subtitle={tab.kind === "note" ? timeAgo(tab.createdAt) : cwdShort(tab.cwd)}
          onRename={onRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </>
  );
}
