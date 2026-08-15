import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, FolderTree, GitBranch, Loader2, RefreshCw, X } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useGitReview } from "@/hooks/useGitReview";
import { useWorkspaceExplorer } from "@/hooks/useWorkspaceExplorer";
import { cwdShort } from "@/lib/session";
import type { WorkspaceMode } from "@/store/ui";

import DiffViewer from "./DiffViewer";
import EditorLauncher from "./EditorLauncher";
import ExplorerTree from "./ExplorerTree";
import FileTree from "./FileTree";
import FileViewer from "./FileViewer";

interface WorkspacePanelProps {
  cwd: string;
  leftInset: number;
  mode: WorkspaceMode;
  onClose: () => void;
}

const WIDTH_STORAGE_KEY = "omp-git-review-width";
const PANEL_DEFAULT = 860;
const PANEL_MIN = 420;
const TREE_WIDTH_STORAGE_KEY = "omp-workspace-tree-width";
const TREE_DEFAULT = 240;
const TREE_MIN = 180;
const CONTENT_MIN = 240;

function clampPanelWidth(width: number, leftInset: number) {
  const maximum = Math.max(0, window.innerWidth - leftInset);
  const minimum = Math.min(PANEL_MIN, maximum);
  return Math.max(minimum, Math.min(maximum, width));
}

function getSavedWidth(leftInset: number) {
  const saved = Number.parseInt(localStorage.getItem(WIDTH_STORAGE_KEY) ?? "", 10);
  return clampPanelWidth(Number.isFinite(saved) ? saved : PANEL_DEFAULT, leftInset);
}

function clampTreeWidth(treeWidth: number, panelWidth: number) {
  return Math.max(
    TREE_MIN,
    Math.min(Math.max(TREE_MIN, panelWidth - CONTENT_MIN), treeWidth)
  );
}

function getSavedTreeWidth(panelWidth: number) {
  const saved = Number.parseInt(localStorage.getItem(TREE_WIDTH_STORAGE_KEY) ?? "", 10);
  return clampTreeWidth(Number.isFinite(saved) ? saved : TREE_DEFAULT, panelWidth);
}

function folderStorageKey(cwd: string) {
  return `omp-workspace-folder:${cwd}`;
}

function getSavedFolder(cwd: string) {
  return localStorage.getItem(folderStorageKey(cwd)) || cwd;
}

export default function WorkspacePanel({
  cwd,
  leftInset,
  mode,
  onClose,
}: WorkspacePanelProps) {
  const [reviewCwd, setReviewCwd] = useState(() => getSavedFolder(cwd));
  const [width, setWidth] = useState(() => getSavedWidth(leftInset));
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const [treeWidth, setTreeWidth] = useState(() => getSavedTreeWidth(width));
  const treeWidthRef = useRef(treeWidth);
  const treeDragging = useRef(false);
  const treeDragStartX = useRef(0);
  const treeDragStartWidth = useRef(0);
  const explorer = useWorkspaceExplorer(reviewCwd, mode === "explorer");
  const git = useGitReview(reviewCwd, mode === "git");
  const selected = mode === "explorer" ? explorer.selected : git.selected;
  const loading = mode === "explorer" ? explorer.loadingEntries : git.loadingChanges;
  const count =
    mode === "explorer"
      ? explorer.entries.filter((entry) => !entry.isDirectory).length
      : (git.snapshot?.files.length ?? 0);

  useEffect(() => setReviewCwd(getSavedFolder(cwd)), [cwd]);

  const chooseFolder = async () => {
    const selectedFolder = await open({
      directory: true,
      multiple: false,
      defaultPath: reviewCwd,
      title: "Choose project folder",
    });
    if (typeof selectedFolder === "string") {
      localStorage.setItem(folderStorageKey(cwd), selectedFolder);
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
      if (dragging.current) {
        const next = clampPanelWidth(
          dragStartWidth.current + dragStartX.current - event.clientX,
          leftInset
        );
        widthRef.current = next;
        setWidth(next);
        setTreeWidth((current) => {
          const clamped = clampTreeWidth(current, next);
          treeWidthRef.current = clamped;
          return clamped;
        });
      } else if (treeDragging.current) {
        const next = clampTreeWidth(
          treeDragStartWidth.current + event.clientX - treeDragStartX.current,
          widthRef.current
        );
        treeWidthRef.current = next;
        setTreeWidth(next);
      }
    };
    const onMouseUp = () => {
      if (!dragging.current && !treeDragging.current) return;
      if (dragging.current) {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(widthRef.current)));
      }
      if (treeDragging.current) {
        localStorage.setItem(
          TREE_WIDTH_STORAGE_KEY,
          String(Math.round(treeWidthRef.current))
        );
      }
      dragging.current = false;
      treeDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
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

  const startTreeResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    treeDragging.current = true;
    treeDragStartX.current = event.clientX;
    treeDragStartWidth.current = treeWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resizeTreeBy = (delta: number) => {
    const next = clampTreeWidth(treeWidthRef.current + delta, widthRef.current);
    treeWidthRef.current = next;
    setTreeWidth(next);
    localStorage.setItem(TREE_WIDTH_STORAGE_KEY, String(Math.round(next)));
  };

  return (
    <aside
      aria-label={mode === "explorer" ? "Project explorer" : "Git changes"}
      data-selected={selected ? "true" : "false"}
      data-mode={mode}
      style={
        {
          "--git-review-width": `${width}px`,
          "--git-review-left-inset": `${leftInset}px`,
          "--workspace-tree-width": `${treeWidth}px`,
        } as CSSProperties
      }
      className="git-review-workspace absolute inset-y-0 right-0 z-20 flex flex-col overflow-hidden
        border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-[-16px_0_32px_rgba(0,0,0,0.28)]"
    >
      <div
        role="separator"
        aria-label="Resize project workspace"
        aria-orientation="vertical"
        onMouseDown={startResize}
        className="git-review-resize-handle group absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize"
      >
        <div
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)]
            transition-colors duration-[var(--duration-fast)] group-hover:bg-[var(--color-accent)]"
        />
      </div>

      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2.5">
        {mode === "explorer" ? (
          <FolderTree
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--color-ink-5)]"
          />
        ) : (
          <GitBranch
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--color-ink-5)]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[var(--color-ink-1)]">
            {mode === "explorer" ? "Explorer" : (git.snapshot?.branch ?? "Git Diff")}
          </p>
          <p
            className="truncate font-mono text-[9px] leading-none text-[var(--color-ink-9)]"
            title={mode === "git" ? (git.snapshot?.root ?? reviewCwd) : reviewCwd}
          >
            {mode === "git" ? (git.snapshot?.root ?? reviewCwd) : reviewCwd}
          </p>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--color-ink-7)]">
          {count}
        </span>
        {mode === "explorer" && <EditorLauncher path={reviewCwd} />}
        <button
          type="button"
          onClick={() => void chooseFolder()}
          title={`Choose project folder · ${reviewCwd}`}
          aria-label="Choose project folder"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-7)]
            hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          <FolderOpen size={13} />
        </button>
        <button
          type="button"
          title={mode === "explorer" ? "Refresh files" : "Refresh changes"}
          aria-label={mode === "explorer" ? "Refresh files" : "Refresh changes"}
          onClick={() => void (mode === "explorer" ? explorer.refresh() : git.refresh())}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-7)]
            hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
        <button
          type="button"
          title="Close workspace"
          aria-label="Close workspace"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-7)]
            hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="git-review-tree flex shrink-0 flex-col border-r border-[var(--color-border)]">
          <div className="min-h-0 flex-1 overflow-auto">
            {mode === "explorer" ? (
              explorer.error && explorer.entries.length === 0 ? (
                <TreeError message={explorer.error} />
              ) : (
                <ExplorerTree
                  entries={explorer.entries}
                  selected={explorer.selected}
                  onSelect={explorer.selectFile}
                />
              )
            ) : git.error && !git.snapshot ? (
              <TreeError message={git.error} />
            ) : (
              <FileTree
                files={git.snapshot?.files ?? []}
                selected={git.selected}
                onSelect={git.selectFile}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--color-border)] px-2 py-1.5">
            <p
              className="truncate font-mono text-[9px] text-[var(--color-ink-9)]"
              title={reviewCwd}
            >
              {cwdShort(reviewCwd)}
            </p>
          </div>
        </div>
        <div
          role="separator"
          aria-label="Resize file explorer"
          aria-orientation="vertical"
          aria-valuemin={TREE_MIN}
          aria-valuenow={Math.round(treeWidth)}
          tabIndex={0}
          onMouseDown={startTreeResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") resizeTreeBy(-16);
            else if (event.key === "ArrowRight") resizeTreeBy(16);
            else return;
            event.preventDefault();
          }}
          className="workspace-tree-resize-handle group relative w-1.5 shrink-0 cursor-col-resize
            focus-visible:outline-none"
        >
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)]
              transition-colors duration-[var(--duration-fast)] group-hover:bg-[var(--color-accent)]
              group-focus:bg-[var(--color-accent)]"
          />
        </div>

        <div className="git-review-diff min-w-0 flex-1">
          {mode === "explorer" ? (
            <FileViewer
              file={explorer.selected}
              content={explorer.content}
              loading={explorer.loadingContent}
              error={explorer.error}
              onBack={() => explorer.selectFile(null)}
            />
          ) : (
            <DiffViewer
              file={git.selected}
              patch={git.patch}
              loading={git.loadingPatch}
              onBack={() => git.selectFile(null)}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

function TreeError({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-4 text-center text-[11px] text-[var(--color-danger)]">
      {message}
    </div>
  );
}
