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
  /** True while the command palette overlay is showing. */
  commandPaletteOpen: boolean;
  /** Active right-side workspace, or null when the workspace is closed. */
  workspaceMode: WorkspaceMode | null;
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
  toggleWorkspace: (mode: WorkspaceMode) => void;
  closeWorkspace: () => void;
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
      workspaceMode: null,
      theme: "system",
      richInputEnabled: false,
      recentOpens: {},

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
      }),
    }
  )
);
