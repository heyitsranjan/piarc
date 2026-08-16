import type { ReactNode } from "react";

import { message } from "@tauri-apps/plugin-dialog";

import { FolderOpen } from "lucide-react";

import { openFolderInFinder } from "@/lib/ipc";
import { cwdShort } from "@/lib/session";

interface TerminalBottomBarProps {
  cwd: string;
  left?: ReactNode;
  right?: ReactNode;
}

export default function TerminalBottomBar({ cwd, left, right }: TerminalBottomBarProps) {
  const openInFinder = () => {
    void openFolderInFinder(cwd).catch((reason) =>
      message(reason instanceof Error ? reason.message : String(reason), {
        title: "Could not open folder",
        kind: "error",
      })
    );
  };

  return (
    <div
      className="flex min-h-6 shrink-0 items-center justify-between gap-3 border-t
        border-[var(--color-border)] bg-[var(--color-bg-raised)] px-2 py-1
        text-[9px] text-[var(--color-ink-9)]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">{left}</span>
        <button
          type="button"
          onClick={openInFinder}
          title={`Open ${cwd} in Finder`}
          aria-label={`Open ${cwd} in Finder`}
          className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5
            text-[var(--color-ink-7)] hover:bg-[var(--color-bg-hover)]
            hover:text-[var(--color-ink-1)]"
        >
          <FolderOpen size={11} className="shrink-0" />
          <span className="truncate font-mono">{cwdShort(cwd)}</span>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}
