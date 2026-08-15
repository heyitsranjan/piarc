/** Sidebar view title and session-specific actions. */
import { Loader2, RotateCcw } from "lucide-react";

import { useSessionStore } from "@/store/sessions";

export default function SidebarHeader() {
  const isLoading = useSessionStore((state) => state.isLoading);
  const loadSessions = useSessionStore((state) => state.loadSessions);

  return (
    <div className="flex h-9 shrink-0 items-center justify-between px-3">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.06em]
        text-[var(--color-ink-5)]"
      >
        Sessions
      </span>
      <button
        type="button"
        onClick={() => loadSessions()}
        title="Refresh sessions (⌘R)"
        aria-label="Refresh sessions"
        className="sidebar-toolbar-button"
      >
        {isLoading ? (
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <RotateCcw size={16} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}
