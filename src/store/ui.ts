/**
 * @module store/ui
 * Zustand slice for global UI state — theme, panel visibility, overlays.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Available color themes. "system" follows the OS preference. */
export type Theme = "dark" | "light" | "system";

export type WorkspaceMode = "explorer" | "git";

export type SidebarMode = "all" | "sessions" | "terminals" | "notes";

export interface WorkspaceState {
  /** Which workspace panel is open, or null when closed (selection still remembered). */
  mode: WorkspaceMode | null;
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
  /** User-defined sidebar ordering (session + tab IDs). Items not listed fall back to recency. */
  sidebarOrder: string[];
  /** True while the per-session note panel drawer is open. */
  notePanelOpen: boolean;
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
  /** Replace the full sidebar ordering. */
  setSidebarOrder: (ids: string[]) => void;
  /** Prepend an item to the sidebar order (new/resumed items attach at top). */
  prependSidebarOrder: (id: string) => void;
  toggleNotePanel: () => void;
  /** Close every workspace drawer (notes + all workspace panels). Called on tab switch. */
  closeAllPanels: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMode: "all",
      commandPaletteOpen: false,
      newDialogOpen: false,
      workspaceBySession: {},
      theme: "system",
      richInputEnabled: false,
      recentOpens: {},
      sidebarOrder: [],
      notePanelOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      openNewDialog: () => set({ newDialogOpen: true }),
      closeNewDialog: () => set({ newDialogOpen: false }),
      toggleWorkspace: (sessionId, mode) =>
        set((s) => {
          const current = s.workspaceBySession[sessionId];
          // Toggle off: set mode to null but keep selection so reopen restores file
          if (current?.mode === mode) {
            return {
              workspaceBySession: {
                ...s.workspaceBySession,
                [sessionId]: { ...current, mode: null },
              },
            };
          }
          // Toggle on / switch mode: close notes, keep existing selection, set new mode
          return {
            notePanelOpen: false,
            workspaceBySession: {
              ...s.workspaceBySession,
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
          const current = s.workspaceBySession[sessionId];
          if (!current) return s;
          // Close panel but preserve file selection for next reopen
          return {
            workspaceBySession: {
              ...s.workspaceBySession,
              [sessionId]: { ...current, mode: null },
            },
          };
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
      setSidebarOrder: (ids) => set({ sidebarOrder: ids }),
      prependSidebarOrder: (id) =>
        set((s) =>
          s.sidebarOrder.includes(id)
            ? // Move to front if already present
              {
                sidebarOrder: [id, ...s.sidebarOrder.filter((x) => x !== id)],
              }
            : { sidebarOrder: [id, ...s.sidebarOrder] }
        ),
      toggleNotePanel: () =>
        set((s) => {
          if (s.notePanelOpen) return { notePanelOpen: false };
          // Opening notes — close every workspace panel
          const closed = Object.fromEntries(
            Object.entries(s.workspaceBySession).map(([id, ws]) => [
              id,
              { ...ws, mode: null as WorkspaceMode | null },
            ])
          );
          return { notePanelOpen: true, workspaceBySession: closed };
        }),
      closeAllPanels: () =>
        set((s) => ({
          notePanelOpen: false,
          workspaceBySession: Object.fromEntries(
            Object.entries(s.workspaceBySession).map(([id, ws]) => [
              id,
              { ...ws, mode: null as WorkspaceMode | null },
            ])
          ),
        })),
    }),
    {
      name: "omp-ui-settings",
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        richInputEnabled: s.richInputEnabled,
        recentOpens: s.recentOpens,
        sidebarOrder: s.sidebarOrder,
      }),
    }
  )
);
