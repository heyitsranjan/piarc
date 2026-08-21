/** Global window chrome shared by the sidebar and terminal. */
import { useEffect, useState } from "react";

import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  FolderTree,
  GitBranch,
  PanelLeft,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  StickyNote,
} from "lucide-react";

import PermissionsDialog from "@/components/PermissionsDialog";
import SettingsDialog from "@/components/SettingsDialog";
import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
} from "@/components/Terminal/constants";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useNewNote } from "@/hooks/useNewNote";
import { useNewSession } from "@/hooks/useNewSession";
import { useTerminal } from "@/hooks/useTerminal";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { isPlainTerminal, useTerminalStore } from "@/store/terminal";
import { type SidebarMode, useUiStore } from "@/store/ui";

import { cn } from "@/lib/utils";

import NewSessionDialog from "./NewSessionDialog";

export default function TitleBar() {
  const [appName, setAppName] = useState("PiArc");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setAppName(import.meta.env.VITE_PIARC_DEV === "1" ? "PiArc Dev" : "PiArc");
  }, []);
  const ompAvailable = useOmpStore((state) => state.status?.installed ?? false);
  const activeSession = useSessionStore((state) => state.activeSession);
  const activeTab = useTerminalStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId)
  );
  const hasTerminals = useTerminalStore((state) => state.tabs.some(isPlainTerminal));
  const title = activeSession
    ? `${activeSession.title} — ${activeSession.cwd.split("/").pop()}`
    : activeTab?.title;
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const workspaceMode = useUiStore((state) =>
    activeSession ? (state.workspaceBySession[activeSession.id]?.mode ?? null) : null
  );
  const toggleWorkspace = useUiStore((state) => state.toggleWorkspace);
  const newDialogOpen = useUiStore((state) => state.newDialogOpen);
  const openNewDialog = useUiStore((state) => state.openNewDialog);
  const closeNewDialog = useUiStore((state) => state.closeNewDialog);
  const notePanelOpen = useUiStore((state) => state.notePanelOpen);
  const toggleNotePanel = useUiStore((state) => state.toggleNotePanel);
  const envPanelOpen = useUiStore((state) => state.envPanelOpen);
  const toggleEnvPanel = useUiStore((state) => state.toggleEnvPanel);
  const { startNewSession, startTerminal, isStarting } = useNewSession();
  const { startNewNote } = useNewNote();
  const { refreshSession } = useTerminal();
  const refreshActiveSession = () => {
    if (!activeSession) return;
    void refreshSession(activeSession, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS);
  };

  const create = (action: () => Promise<void>) => {
    if (isStarting) return;
    closeNewDialog();
    void action();
  };

  const showSidebar = (mode: SidebarMode) => {
    if (mode === "terminals" && !hasTerminals) return;
    setSidebarMode(mode);
    if (sidebarCollapsed) toggleSidebar();
  };

  useKeyboard([
    { key: "n", meta: true, handler: openNewDialog },
    {
      key: "n",
      meta: true,
      shift: true,
      handler: () => create(startNewSession),
    },
    { key: "t", meta: true, handler: () => create(startTerminal) },
    {
      key: "o",
      meta: true,
      shift: true,
      handler: () => {
        closeNewDialog();
        startNewNote();
      },
    },
    {
      key: "0",
      meta: true,
      shift: true,
      handler: () => showSidebar("all"),
    },
    {
      key: "1",
      meta: true,
      shift: true,
      handler: () => showSidebar("sessions"),
    },
    {
      key: "2",
      meta: true,
      shift: true,
      handler: () => showSidebar("terminals"),
    },
    { key: "b", meta: true, handler: toggleSidebar },
    {
      key: "e",
      meta: true,
      handler: () => {
        if (activeSession) toggleWorkspace(activeSession.id, "explorer");
      },
    },
    {
      key: "g",
      meta: true,
      handler: () => {
        if (activeSession) toggleWorkspace(activeSession.id, "git");
      },
    },
    { key: "k", meta: true, handler: openCommandPalette },
    { key: "p", meta: true, handler: openCommandPalette },
    { key: "r", meta: true, handler: refreshActiveSession },
  ]);

  useEffect(() => {
    let appWindow: ReturnType<typeof getCurrentWindow>;
    try {
      appWindow = getCurrentWindow();
    } catch {
      return;
    }

    const syncFullscreen = () => {
      void appWindow
        .isFullscreen()
        .then(setIsFullscreen)
        .catch(() => setIsFullscreen(false));
    };

    syncFullscreen();
    const unlisten = appWindow.onResized(syncFullscreen).catch(() => undefined);
    return () => {
      void unlisten.then((stop) => stop?.());
    };
  }, []);

  return (
    <>
      <header
        className="app-titlebar relative flex shrink-0 items-center border-b border-[var(--color-border)]
        bg-[var(--color-titlebar)]"
        data-fullscreen={isFullscreen || undefined}
        data-tauri-drag-region
      >
        <div
          className="titlebar-leading flex min-w-0 items-center gap-2"
          data-tauri-drag-region
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title="Toggle sidebar (⌘B)"
            aria-label="Toggle sidebar"
            className="titlebar-button"
          >
            <PanelLeft size={16} strokeWidth={1.8} />
          </button>
          <span className="arc-brand">
            <strong>{appName}</strong>
            <small>OMP desktop companion</small>
          </span>
        </div>

        {title && (
          <div
            className="pointer-events-none absolute left-[376px] right-[440px] truncate
              text-center font-mono text-[9px] text-[var(--color-ink-7)]"
            title={title}
          >
            {title}
          </div>
        )}

        <div
          className="ml-auto mr-[10px] flex items-center justify-end gap-[3px]"
          data-tauri-drag-region
        >
          <button
            type="button"
            onClick={refreshActiveSession}
            disabled={!activeSession || activeTab?.isLoading}
            title={
              activeSession
                ? `Restart terminal for ${activeSession.title} (⌘R)`
                : "Select a session to refresh"
            }
            aria-label="Refresh active session terminal"
            className="titlebar-action"
          >
            <RotateCcw size={13} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => activeSession && toggleWorkspace(activeSession.id, "explorer")}
            disabled={!activeSession || activeTab?.kind === "note"}
            title="Open project explorer (⌘E)"
            aria-label="Open project explorer"
            aria-pressed={workspaceMode === "explorer"}
            className={cn(
              "titlebar-action",
              workspaceMode === "explorer" && "titlebar-action-active"
            )}
          >
            <FolderTree size={14} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => activeSession && toggleWorkspace(activeSession.id, "git")}
            disabled={!activeSession || activeTab?.kind === "note"}
            title="Review Git changes (⌘G)"
            aria-label="Review Git changes"
            aria-pressed={workspaceMode === "git"}
            className={cn(
              "titlebar-action",
              workspaceMode === "git" && "titlebar-action-active"
            )}
          >
            <GitBranch size={14} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleNotePanel}
            disabled={!activeTab || activeTab?.kind === "note"}
            title="Session notes"
            aria-label="Toggle session notes"
            aria-pressed={notePanelOpen}
            className={cn("titlebar-action", notePanelOpen && "titlebar-action-active")}
          >
            <StickyNote size={14} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleEnvPanel}
            disabled={!activeTab || activeTab?.kind === "note"}
            title="Session environment variables"
            aria-label="Toggle session environment"
            aria-pressed={envPanelOpen}
            className={cn("titlebar-action", envPanelOpen && "titlebar-action-active")}
          >
            <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
            className="titlebar-action"
          >
            <Settings2 size={14} strokeWidth={1.8} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPermissionsOpen(true)}
            title="Privacy & Permissions"
            aria-label="Privacy and permissions"
            className="titlebar-action"
          >
            <ShieldCheck size={14} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </header>
      {permissionsOpen && <PermissionsDialog onClose={() => setPermissionsOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {newDialogOpen && (
        <NewSessionDialog
          ompAvailable={ompAvailable}
          busy={isStarting}
          onClose={closeNewDialog}
          onNewSession={startNewSession}
          onTerminal={startTerminal}
          onNote={startNewNote}
        />
      )}
    </>
  );
}
