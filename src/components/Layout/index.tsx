/**
 * Application workbench: global title bar, resizable session sidebar, terminal.
 */
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { LoaderCircle } from "lucide-react";

import CommandPalette from "@/components/CommandPalette";
import WorkspacePanel from "@/components/GitReview";
import Sidebar from "@/components/Sidebar";
import TerminalArea from "@/components/Terminal";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

import type { GitChangesSnapshot } from "@/lib/git";
import { getGitChanges } from "@/lib/ipc";
import { cwdShort } from "@/lib/session";

import packageInfo from "../../../package.json";
import TitleBar from "./TitleBar";

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 280;
const TERMINAL_MIN = 480;
const RESIZE_HANDLE_WIDTH = 6;
const STORAGE_KEY = "omp-sidebar-width";
const REVIEW_SIDEBAR_GAP = 16;

function availableSidebarMax() {
  if (window.innerWidth < 800) return Math.min(SIDEBAR_MAX, window.innerWidth);
  return Math.max(
    SIDEBAR_MIN,
    Math.min(SIDEBAR_MAX, window.innerWidth - TERMINAL_MIN - RESIZE_HANDLE_WIDTH)
  );
}

function clampSidebarWidth(width: number) {
  const minimum = Math.min(SIDEBAR_MIN, window.innerWidth);
  return Math.max(minimum, Math.min(availableSidebarMax(), width));
}

function getSavedWidth() {
  try {
    const saved = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
    return clampSidebarWidth(Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT);
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

export default function Layout() {
  const activeSession = useSessionStore((state) => state.activeSession);
  const ompStatus = useOmpStore((state) => state.status);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const commandPaletteOpen = useUiStore((state) => state.commandPaletteOpen);
  const workspaceState = useUiStore((state) =>
    activeSession ? state.workspaceBySession[activeSession.id] : undefined
  );
  const workspaceMode = workspaceState?.mode ?? null;
  const ompVersion = useOmpStore((state) => state.status?.version);
  const ompUpdate = useOmpStore((state) => state.update);
  const updateState = useOmpStore((state) => state.updateState);
  const updateError = useOmpStore((state) => state.updateError);
  const checkForUpdate = useOmpStore((state) => state.checkForUpdate);
  const installUpdate = useOmpStore((state) => state.installUpdate);
  const closeWorkspace = useUiStore((state) => state.closeWorkspace);
  const setWorkspaceSelection = useUiStore((state) => state.setWorkspaceSelection);
  const [gitStatus, setGitStatus] = useState<GitChangesSnapshot | null>(null);
  const [width, setWidth] = useState(getSavedWidth);
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      const next = clampSidebarWidth(
        dragStartWidth.current + event.clientX - dragStartX.current
      );
      widthRef.current = next;
      setWidth(next);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(Math.round(widthRef.current)));
    };

    const onWindowResize = () => {
      setWidth(clampSidebarWidth(widthRef.current));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  useEffect(() => {
    if (!activeSession?.cwd) {
      setGitStatus(null);
      return;
    }
    let current = true;
    const refresh = () => {
      void getGitChanges(activeSession.cwd)
        .then((snapshot) => {
          if (current) setGitStatus(snapshot);
        })
        .catch(() => {
          if (current) setGitStatus(null);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [activeSession?.cwd]);

  const startResize = (event: ReactMouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <TitleBar />

      <div className="workbench relative flex min-h-0 flex-1 overflow-hidden">
        {!sidebarCollapsed && (
          <>
            <aside
              style={{ width, minWidth: width, maxWidth: width }}
              className="sidebar-panel flex h-full flex-col overflow-hidden
                bg-[var(--color-sidebar)]"
            >
              <Sidebar />
            </aside>

            <div
              role="separator"
              aria-label="Resize sidebar"
              aria-orientation="vertical"
              onMouseDown={startResize}
              className="resize-handle group relative z-10 -ml-1.5 w-1.5 shrink-0 cursor-col-resize"
            >
              <div
                className="absolute inset-y-0 right-0 w-px bg-[var(--color-border)]
                  transition-colors duration-[var(--duration-fast)]
                  group-hover:bg-[var(--color-accent)]"
              />
            </div>
          </>
        )}

        <main
          className="session-enter flex min-w-0 flex-1 flex-col overflow-hidden
            bg-[#0a0b0e]"
        >
          <TerminalArea />
        </main>
        {workspaceMode && activeSession?.cwd && (
          <WorkspacePanel
            cwd={activeSession.cwd}
            sessionId={activeSession.id}
            leftInset={sidebarCollapsed ? 0 : width + REVIEW_SIDEBAR_GAP}
            mode={workspaceMode}
            savedFile={workspaceState?.selectedFile ?? null}
            savedGitKey={workspaceState?.selectedGitKey ?? null}
            onSelectionChange={setWorkspaceSelection}
            onClose={() => closeWorkspace(activeSession.id)}
          />
        )}
      </div>

      <footer className="arc-statusbar">
        <span className={ompStatus?.installed ? "arc-status-ok" : undefined}>
          {ompStatus?.installed
            ? `● OMP ${ompVersion ?? "connected"}`
            : "○ OMP unavailable"}
        </span>
        {updateState === "checking" && (
          <span className="flex items-center gap-1">
            <LoaderCircle className="animate-spin" size={9} aria-hidden />
            Checking updates…
          </span>
        )}
        {updateState === "updating" && (
          <span className="flex items-center gap-1">
            <LoaderCircle className="animate-spin" size={9} aria-hidden />
            Updating OMP…
          </span>
        )}
        {updateState === "idle" && ompUpdate?.availableVersion && (
          <button
            type="button"
            onClick={() => void installUpdate()}
            title={`Install OMP ${ompUpdate.availableVersion}`}
            aria-label={`Install OMP ${ompUpdate.availableVersion}`}
            className="cursor-pointer text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            {`Update ${ompUpdate.availableVersion}`}
          </button>
        )}
        {updateState === "error" && (
          <button
            type="button"
            onClick={() => void checkForUpdate()}
            title={updateError ?? "Update check failed"}
            className="cursor-pointer text-[var(--color-warn)] hover:text-[var(--color-ink-1)]"
          >
            Update check failed · Retry
          </button>
        )}
        <span>{activeSession ? cwdShort(activeSession.cwd) : "No session selected"}</span>
        {gitStatus && (
          <span>{`${gitStatus.branch} · ${gitStatus.files.length} changes`}</span>
        )}
        <span className="ml-auto">{`PiArc ${packageInfo.version}`}</span>
      </footer>

      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
