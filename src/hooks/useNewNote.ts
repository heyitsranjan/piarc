/**
 * @module hooks/useNewNote
 * Creates a new note tab.
 */
import { useCallback } from "react";

import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

export interface UseNewNoteReturn {
  /** Create a new note tab and make it active. */
  startNewNote: () => void;
}

export function useNewNote(): UseNewNoteReturn {
  const { openTab } = useTerminalStore();
  const setSidebarMode = useUiStore((state) => state.setSidebarMode);
  const prependSidebarOrder = useUiStore((state) => state.prependSidebarOrder);

  const startNewNote = useCallback(() => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const tabId = openTab({
      id,
      kind: "note",
      sessionId: `__note__${timestamp}`,
      title: "Note",
      cwd: "",
    });
    setSidebarMode("all");
    prependSidebarOrder(tabId);
  }, [openTab, setSidebarMode, prependSidebarOrder]);

  return { startNewNote };
}
