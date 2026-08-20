/**
 * @module store/ui
 * Zustand slice for global UI state — theme, panel visibility, overlays.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Available color themes. "system" follows the OS preference. */
export type Theme = "dark" | "light" | "system";

export type WorkspaceMode = "explorer" | "git";

export type SidebarMode = "sessions" | "terminals";

export interface WorkspaceState {
  /** Which workspace panel is open, or null when closed. */
  mode: WorkspaceMode;
  /** Selected file path in explorer mode. */
  selectedFile: string | null;
  /** Selected git change key (staged|working:path) in git mode. */
  selectedGitKey: string | null;
}

interface UiState {
  /** Controls sidebar visibility (toggled by ⌘B). */
  sidebarCollapsed: boolean;
  /** Which item collection the sidebar is showing. */
  sidebarMode: SidebarMode;
  /** True while the session-or-terminal chooser is showing. */
  newDialogOpen: boolean;
  /** True while the command palette overlay is showing. */
  commandPaletteOpen: boolean;
  /** Per-session workspace state: sessionId → workspace panel state. */
  workspaceBySession: Record<string, WorkspaceState>;
  /** Active color theme. */
  theme: Theme;
  /** Whether the experimental rich composer owns text input instead of the active terminal. */
  richInputEnabled: boolean;
  /** Map of item id → last-opened timestamp.  Used to sort palette results by recency. */
  recentOpens: Record<string, number>;

  toggleSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openNewDialog: () => void;
  closeNewDialog: () => void;
  /** Toggle a workspace panel mode for the given session. */
  toggleWorkspace: (sessionId: string, mode: WorkspaceMode) => void;
  /** Close the workspace panel for the given session. */
  closeWorkspace: (sessionId: string) => void;
  /** Update the selected file / git key for a session's workspace. */
  setWorkspaceSelection: (
    sessionId: string,
    patch: Partial<Pick<WorkspaceState, "selectedFile" | "selectedGitKey">>
  ) => void;
  setTheme: (t: Theme) => void;
  toggleRichInput: () => void;
  /** Record that an item (session or tab) was just opened. */
  touchRecentOpen: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMode: "sessions",
      commandPaletteOpen: false,
      newDialogOpen: false,
      workspaceBySession: {},
      theme: "system",
      richInputEnabled: false,
      recentOpens: {},

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      openNewDialog: () => set({ newDialogOpen: true }),
      closeNewDialog: () => set({ newDialogOpen: false }),
      toggleWorkspace: (sessionId, mode) =>
        set((s) => {
          const current = s.workspaceBySession[sessionId];
          const isMode = current?.mode === mode;
          const rest = { ...s.workspaceBySession };
          delete rest[sessionId];
          return {
            workspaceBySession: isMode
              ? rest
              : {
                  ...rest,
                  [sessionId]: {
                    mode,
                    selectedFile: current?.selectedFile ?? null,
                    selectedGitKey: current?.selectedGitKey ?? null,
                  },
                },
          };
        }),
      closeWorkspace: (sessionId) =>
        set((s) => {
          const rest = { ...s.workspaceBySession };
          delete rest[sessionId];
          return { workspaceBySession: rest };
        }),
      setWorkspaceSelection: (sessionId, patch) =>
        set((s) => {
          const current = s.workspaceBySession[sessionId];
          if (!current) return s;
          return {
            workspaceBySession: {
              ...s.workspaceBySession,
              [sessionId]: { ...current, ...patch },
            },
          };
        }),
      setTheme: (theme) => set({ theme }),
      toggleRichInput: () => set((s) => ({ richInputEnabled: !s.richInputEnabled })),
      touchRecentOpen: (id) =>
        set((s) => ({ recentOpens: { ...s.recentOpens, [id]: Date.now() } })),
    }),
    {
      name: "omp-ui-settings",
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        richInputEnabled: s.richInputEnabled,
        recentOpens: s.recentOpens,
        workspaceBySession: s.workspaceBySession,
      }),
    }
  )
);
