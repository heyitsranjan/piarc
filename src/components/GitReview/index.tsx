import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, GitBranch, Loader2, RefreshCw, X } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useGitReview } from "@/hooks/useGitReview";
import { cwdShort } from "@/lib/session";

import DiffViewer from "./DiffViewer";
import FileTree from "./FileTree";

interface GitReviewProps {
  cwd: string;
  leftInset: number;
  onClose: () => void;
}

const FOLDER_STORAGE_KEY = "omp-git-review-folder";
const WIDTH_STORAGE_KEY = "omp-git-review-width";
const PANEL_DEFAULT = 860;
const PANEL_MIN = 420;

function clampPanelWidth(width: number, leftInset: number) {
  const maximum = Math.max(0, window.innerWidth - leftInset);
  const minimum = Math.min(PANEL_MIN, maximum);
  return Math.max(minimum, Math.min(maximum, width));
}

function getSavedWidth(leftInset: number) {
  const saved = Number.parseInt(localStorage.getItem(WIDTH_STORAGE_KEY) ?? "", 10);
  return clampPanelWidth(Number.isFinite(saved) ? saved : PANEL_DEFAULT, leftInset);
}

function getSavedFolder(fallback: string) {
  return localStorage.getItem(FOLDER_STORAGE_KEY) || fallback;
}

export default function GitReview({ cwd, leftInset, onClose }: GitReviewProps) {
  const [reviewCwd, setReviewCwd] = useState(() => getSavedFolder(cwd));
  const [width, setWidth] = useState(() => getSavedWidth(leftInset));
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const {
    snapshot,
    selected,
    patch,
    loadingChanges,
    loadingPatch,
    error,
    refresh,
    selectFile,
  } = useGitReview(reviewCwd, true);

  useEffect(() => setReviewCwd(getSavedFolder(cwd)), [cwd]);

  const chooseFolder = async () => {
    const selectedFolder = await open({
      directory: true,
      multiple: false,
      defaultPath: reviewCwd,
      title: "Choose repository folder",
    });
    if (typeof selectedFolder === "string") {
      localStorage.setItem(FOLDER_STORAGE_KEY, selectedFolder);
      setReviewCwd(selectedFolder);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      const next = clampPanelWidth(
        dragStartWidth.current + dragStartX.current - event.clientX,
        leftInset
      );
      widthRef.current = next;
      setWidth(next);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(widthRef.current)));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [leftInset]);

  const startResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current =
      event.currentTarget.parentElement?.getBoundingClientRect().width ?? width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <aside
      aria-label="Git changes"
      data-selected={selected ? "true" : "false"}
      style={
        {
          "--git-review-width": `${width}px`,
          "--git-review-left-inset": `${leftInset}px`,
        } as CSSProperties
      }
      className="git-review-workspace absolute inset-y-0 right-0 z-20 flex flex-col overflow-hidden
        border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-[-16px_0_32px_rgba(0,0,0,0.28)]"
    >
      <div
        role="separator"
        aria-label="Resize Git review panel"
        aria-orientation="vertical"
        onMouseDown={startResize}
        className="git-review-resize-handle group absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize"
      >
        <div
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)]
            transition-colors duration-[var(--duration-fast)] group-hover:bg-[var(--color-accent)]"
        />
      </div>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2.5">
        <GitBranch
          size={14}
          strokeWidth={1.8}
          className="shrink-0 text-[var(--color-ink-5)]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[var(--color-ink-1)]">
            {snapshot?.branch ?? "Changes"}
          </p>
          {snapshot && (
            <p
              className="truncate font-mono text-[9px] leading-none text-[var(--color-ink-9)]"
              title={snapshot.root}
            >
              {snapshot.root}
            </p>
          )}
        </div>
        <span className="text-[10px] tabular-nums text-[var(--color-ink-7)]">
          {snapshot?.files.length ?? 0}
        </span>
        <button
          type="button"
          title="Refresh changes"
          aria-label="Refresh changes"
          onClick={() => void refresh()}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-7)]
            hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          {loadingChanges ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
        <button
          type="button"
          title="Close changes"
          aria-label="Close changes"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-7)]
            hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="git-review-tree flex w-60 shrink-0 flex-col border-r border-[var(--color-border)]">
          <div className="min-h-0 flex-1 overflow-auto">
            {error && !snapshot ? (
              <div className="flex min-h-32 items-center justify-center px-4 text-center text-[11px] text-[var(--color-danger)]">
                {error}
              </div>
            ) : (
              <FileTree
                files={snapshot?.files ?? []}
                selected={selected}
                onSelect={selectFile}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--color-border)] p-2">
            <p className="mb-1 px-1 text-[9px] font-semibold tracking-[0.08em] text-[var(--color-ink-9)] uppercase">
              Review folder
            </p>
            <button
              type="button"
              onClick={() => void chooseFolder()}
              title={`Choose folder · ${reviewCwd}`}
              className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)]
                bg-[var(--color-bg)] px-2 text-left text-[11px] text-[var(--color-ink-5)]
                hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
            >
              <FolderOpen size={13} strokeWidth={1.7} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{cwdShort(reviewCwd)}</span>
            </button>
          </div>
        </div>
        <div className="git-review-diff min-w-0 flex-1">
          <DiffViewer
            file={selected}
            patch={patch}
            loading={loadingPatch}
            onBack={() => selectFile(null)}
          />
        </div>
      </div>
    </aside>
  );
}
