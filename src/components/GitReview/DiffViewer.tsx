import "react-diff-view/style/index.css";

import { Columns2, Rows3 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Diff, Hunk, parseDiff } from "react-diff-view";

import type { GitFileChange } from "@/lib/git";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  file: GitFileChange | null;
  patch: string;
  loading: boolean;
  onBack: () => void;
}

type ViewType = "unified" | "split";

export default function DiffViewer({ file, patch, loading, onBack }: DiffViewerProps) {
  const [viewType, setViewType] = useState<ViewType>("unified");
  const parsed = useMemo(() => {
    if (!patch) return { files: [], error: null };
    try {
      return { files: parseDiff(patch), error: null };
    } catch (cause) {
      return { files: [], error: cause instanceof Error ? cause.message : String(cause) };
    }
  }, [patch]);

  if (!file) {
    return <Empty message="Select a changed file to inspect its diff" />;
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--color-bg)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2">
        <button
          type="button"
          onClick={onBack}
          className="git-review-back hidden h-6 items-center rounded-[var(--radius-sm)] px-1.5 text-[11px]
            text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          Files
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--color-ink-1)]">
          {file.path}
        </span>
        <div className="flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-px">
          <ViewButton
            active={viewType === "unified"}
            label="Unified"
            onClick={() => setViewType("unified")}
          >
            <Rows3 size={13} />
          </ViewButton>
          <ViewButton
            active={viewType === "split"}
            label="Split"
            onClick={() => setViewType("split")}
          >
            <Columns2 size={13} />
          </ViewButton>
        </div>
      </div>

      <div className="git-diff-scroll min-h-0 flex-1 overflow-auto">
        {loading ? (
          <Empty message="Loading diff…" />
        ) : parsed.error ? (
          <Empty message={parsed.error} danger />
        ) : parsed.files.length === 0 ? (
          <Empty message="No textual diff available" />
        ) : (
          <div className="git-diff-view min-w-full py-2 font-mono text-[11px]">
            {parsed.files.map((diffFile, index) => (
              <Diff
                key={`${diffFile.oldPath}-${diffFile.newPath}-${index}`}
                viewType={viewType}
                diffType={diffFile.type}
                hunks={diffFile.hunks}
                gutterType="default"
              >
                {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
              </Diff>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ViewButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function ViewButton({ active, label, onClick, children }: ViewButtonProps) {
  return (
    <button
      type="button"
      title={`${label} diff`}
      aria-label={`${label} diff`}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-5 w-6 items-center justify-center rounded-[3px] text-[var(--color-ink-7)]",
        "hover:text-[var(--color-ink-1)]",
        active && "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)]"
      )}
    >
      {children}
    </button>
  );
}

function Empty({ message, danger = false }: { message: string; danger?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-32 items-center justify-center px-6 text-center text-[11px]",
        danger ? "text-[var(--color-danger)]" : "text-[var(--color-ink-7)]"
      )}
    >
      {message}
    </div>
  );
}
