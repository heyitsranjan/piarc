/**
 * @module store/ui
 * Zustand slice for global UI state — theme, panel visibility, overlays.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Available color themes. "system" follows the OS preference. */
export type Theme = "dark" | "light" | "system";

interface UiState {
  /** Controls sidebar visibility (toggled by ⌘B). */
  sidebarCollapsed: boolean;
  /** True while the ⌘K command palette is showing. */
  commandPaletteOpen: boolean;
  /** True while the right-side Git review workspace is visible. */
  gitReviewOpen: boolean;
  /** Active color theme. */
  theme: Theme;

  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleGitReview: () => void;
  closeGitReview: () => void;
  setTheme: (t: Theme) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      gitReviewOpen: false,
      theme: "system",

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleGitReview: () => set((s) => ({ gitReviewOpen: !s.gitReviewOpen })),
      closeGitReview: () => set({ gitReviewOpen: false }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "omp-ui-settings",
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
