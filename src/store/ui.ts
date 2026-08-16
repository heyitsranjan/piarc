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

interface UiState {
  /** Controls sidebar visibility (toggled by ⌘B). */
  sidebarCollapsed: boolean;
  /** Which item collection the sidebar is showing. */
  sidebarMode: SidebarMode;
  /** True while the session-or-terminal chooser is showing. */
  newDialogOpen: boolean;
  /** True while the ⌘K command palette is showing. */
  commandPaletteOpen: boolean;
  /** Active right-side workspace, or null when the workspace is closed. */
  workspaceMode: WorkspaceMode | null;
  /** Active color theme. */
  theme: Theme;
  /** Whether the rich composer owns text input instead of the active terminal. */
  richInputEnabled: boolean;

  toggleSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  openCommandPalette: () => void;
  openNewDialog: () => void;
  closeNewDialog: () => void;
  closeCommandPalette: () => void;
  toggleWorkspace: (mode: WorkspaceMode) => void;
  closeWorkspace: () => void;
  setTheme: (t: Theme) => void;
  toggleRichInput: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMode: "sessions",
      commandPaletteOpen: false,
      newDialogOpen: false,
      workspaceMode: null,
      theme: "system",
      richInputEnabled: true,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      openNewDialog: () => set({ newDialogOpen: true }),
      closeNewDialog: () => set({ newDialogOpen: false }),
      toggleWorkspace: (mode) =>
        set((state) => ({ workspaceMode: state.workspaceMode === mode ? null : mode })),
      closeWorkspace: () => set({ workspaceMode: null }),
      setTheme: (theme) => set({ theme }),
      toggleRichInput: () => set((s) => ({ richInputEnabled: !s.richInputEnabled })),
    }),
    {
      name: "omp-ui-settings",
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        richInputEnabled: s.richInputEnabled,
      }),
    }
  )
);
