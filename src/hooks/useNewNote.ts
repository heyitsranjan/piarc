/**
 * @module hooks/useNewNote
 * Creates a new plain-text note tab and makes it active.
 * Notes have no PTY, no agent, and no working directory.
 */
import { useCallback } from "react";

import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseNewNoteReturn {
  /** Create a new note tab, prepend it to the sidebar, and switch to it. */
  startNewNote: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Provides a `startNewNote` action that opens a blank note tab.
 *
 * @example
 * const { startNewNote } = useNewNote();
 * startNewNote();
 */
export function useNewNote(): UseNewNoteReturn {
  const { openTab } = useTerminalStore();
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);
  const prependSidebarOrder = useUiStore((state) => state.prependSidebarOrder);

  const startNewNote = useCallback(() => {
    const tabId = openTab({
      id: crypto.randomUUID(),
      kind: "note",
      agent: null,
      startCmd: null,
      resumeCmd: null,
      path: "",
      firstMessage: "",
      sessionId: `__note__${Date.now()}`,
      title: "Note",
      cwd: "",
    });
    setSidebarMode("all");
    prependSidebarOrder(tabId);
  }, [openTab, setSidebarMode, prependSidebarOrder]);

  return { startNewNote };
}
