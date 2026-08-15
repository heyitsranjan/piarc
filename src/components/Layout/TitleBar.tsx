/** Global window chrome shared by the sidebar and terminal. */
import { useEffect, useState } from "react";

import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  FileDiff,
  Files,
  Loader2,
  PanelLeft,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";

import PermissionsDialog from "@/components/PermissionsDialog";
import SettingsDialog from "@/components/SettingsDialog";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useNewSession } from "@/hooks/useNewSession";

import { useOmpStore } from "@/store/omp";
import { useSessionStore } from "@/store/sessions";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

import { cn } from "@/lib/utils";

import NewSessionDialog from "./NewSessionDialog";

export default function TitleBar() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const ompAvailable = useOmpStore((state) => state.status?.installed ?? false);
  const activeSession = useSessionStore((state) => state.activeSession);
  const activeTab = useTerminalStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId)
  );
  const hasTerminals = useTerminalStore((state) =>
    state.tabs.some((tab) => tab.kind === "terminal")
  );
  const title = activeSession?.title ?? activeTab?.title;
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const workspaceMode = useUiStore((state) => state.workspaceMode);
  const toggleWorkspace = useUiStore((state) => state.toggleWorkspace);
  const { startNewSession, startTerminal, isStarting } = useNewSession();

  const create = (action: () => Promise<void>) => {
    if (isStarting) return;
    setNewDialogOpen(false);
    void action();
  };

  const showSidebar = (mode: "sessions" | "terminals") => {
    if (mode === "terminals" && !hasTerminals) return;
    setSidebarMode(mode);
    if (sidebarCollapsed) toggleSidebar();
  };

  useKeyboard([
    { key: "n", meta: true, handler: () => setNewDialogOpen(true) },
    {
      key: "n",
      meta: true,
      shift: true,
      handler: () => create(startNewSession),
    },
    { key: "t", meta: true, handler: () => create(startTerminal) },
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
        if (activeSession) toggleWorkspace("explorer");
      },
    },
    {
      key: "g",
      meta: true,
      handler: () => {
        if (activeSession) toggleWorkspace("git");
      },
    },
    { key: "k", meta: true, handler: openCommandPalette },
    { key: "r", meta: true, handler: () => void loadSessions() },
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
          className="titlebar-leading flex min-w-0 items-center gap-1"
          data-tauri-drag-region
        >
          <button
            type="button"
            onClick={toggleSidebar}
            title="Toggle sidebar (⌘B)"
            aria-label="Toggle sidebar"
            className="titlebar-button"
          >
            <PanelLeft size={18} strokeWidth={1.7} />
          </button>
          <span className="app-wordmark truncate text-[13px] font-medium text-[var(--color-ink-1)]">
            πx
          </span>
        </div>

        {title && (
          <div
            className="pointer-events-none absolute left-1/2 max-w-[42%] -translate-x-1/2 truncate
            text-center text-[13px] font-medium text-[var(--color-ink-1)]"
            title={title}
          >
            {title}
          </div>
        )}

        <div className="ml-auto flex items-center gap-0.5 pr-2" data-tauri-drag-region>
          <button
            type="button"
            onClick={() => toggleWorkspace("explorer")}
            disabled={!activeSession}
            title="Open project explorer (⌘E)"
            aria-label="Open project explorer"
            aria-pressed={workspaceMode === "explorer"}
            className={cn(
              "titlebar-button",
              workspaceMode === "explorer" &&
                "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)]"
            )}
          >
            <Files size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => toggleWorkspace("git")}
            disabled={!activeSession}
            title="Review Git changes (⌘G)"
            aria-label="Review Git changes"
            aria-pressed={workspaceMode === "git"}
            className={cn(
              "titlebar-button",
              workspaceMode === "git" &&
                "bg-[var(--color-bg-hi)] text-[var(--color-ink-0)]"
            )}
          >
            <FileDiff size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
            className="titlebar-button"
          >
            <Settings size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setPermissionsOpen(true)}
            title="Privacy & Permissions"
            aria-label="Privacy and permissions"
            className="titlebar-button"
          >
            <ShieldCheck size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setNewDialogOpen(true)}
            disabled={isStarting}
            title="Create (⌘N)"
            aria-label="Create session or terminal"
            className="titlebar-button"
          >
            {isStarting ? (
              <Loader2 size={17} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Plus size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </header>
      {permissionsOpen && <PermissionsDialog onClose={() => setPermissionsOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {newDialogOpen && (
        <NewSessionDialog
          ompAvailable={ompAvailable}
          busy={isStarting}
          onClose={() => setNewDialogOpen(false)}
          onNewSession={startNewSession}
          onTerminal={startTerminal}
        />
      )}
    </>
  );
}
