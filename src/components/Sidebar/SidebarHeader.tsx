/**
 * @module components/Sidebar/SidebarHeader
 * Top chrome of the sidebar — macOS traffic-light offset + drag region.
 */
import { Loader2, PanelLeft, Plus, RotateCcw } from "lucide-react";

import Button from "@/components/ui/Button";
import { useNewSession } from "@/hooks/useNewSession";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

export default function SidebarHeader() {
  const { isLoading, loadSessions } = useSessionStore();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { startNewSession, isStarting } = useNewSession();

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: "var(--titlebar-height)", paddingLeft: 76, paddingRight: 8 }}
      data-tauri-drag-region
    >
      {/* Collapse + wordmark */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar (⌘B)"
          aria-label="Collapse sidebar"
          className="flex items-center justify-center w-[26px] h-[26px]
            rounded-[var(--radius-sm)] text-[var(--color-ink-9)]
            hover:text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]
            transition-colors duration-[var(--duration-fast)]"
        >
          <PanelLeft size={14} strokeWidth={1.5} />
        </button>
        <span className="text-[11px] font-semibold tracking-[0.03em]
          text-[var(--color-ink-9)] select-none leading-none">
          Oh My Pi
        </span>
      </div>

      {/* New session + refresh */}
      <div className="flex items-center">
        <Button variant="ghost" onClick={startNewSession} disabled={isStarting}
          title="New session" aria-label="New omp session"
          className="w-[26px] h-[26px] p-0">
          {isStarting
            ? <Loader2 size={12} strokeWidth={1.8} className="animate-spin" />
            : <Plus size={13} strokeWidth={2} />}
        </Button>
        <Button variant="ghost" onClick={() => loadSessions()}
          title="Refresh (⌘R)" aria-label="Refresh sessions"
          className="w-[26px] h-[26px] p-0">
          {isLoading
            ? <Loader2 size={12} strokeWidth={1.8} className="animate-spin" />
            : <RotateCcw size={12} strokeWidth={1.8} />}
        </Button>
      </div>
    </div>
  );
}
