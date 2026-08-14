/**
 * @module components/Sidebar/SidebarHeader
 * Top chrome of the unified left panel.
 *
 * Acts as the window titlebar for the sidebar region:
 * - macOS traffic-light offset (80px left padding)
 * - data-tauri-drag-region for window dragging
 * - Panel collapse toggle
 * - App name
 * - New session + refresh actions
 */
import Button from "@/components/ui/Button";
import { useNewSession } from "@/hooks/useNewSession";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

function CollapseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="1.5" y="2" width="13" height="12" rx="2" />
      <line x1="5.5" y1="2" x2="5.5" y2="14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      className="animate-spin">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

export default function SidebarHeader() {
  const { isLoading, loadSessions } = useSessionStore();
  const toggleSidebar               = useUiStore((s) => s.toggleSidebar);
  const { startNewSession, isStarting } = useNewSession();

  return (
    <div
      className="flex items-center justify-between shrink-0 px-2"
      style={{ height: "var(--titlebar-height)", paddingLeft: 76 }}
      data-tauri-drag-region
    >
      {/* ── Left: collapse + app name ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar (⌘B)"
          aria-label="Collapse sidebar"
          className="flex items-center justify-center w-6 h-6
            rounded-[var(--radius-sm)] text-[var(--color-ink-9)]
            hover:text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]
            transition-colors duration-[var(--duration-fast)]"
        >
          <CollapseIcon />
        </button>

        <span className="text-[11px] font-semibold tracking-[0.04em]
          text-[var(--color-ink-9)] select-none">
          Oh My Pi
        </span>
      </div>

      {/* ── Right: new session + refresh ───────────────────────────────────── */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          onClick={startNewSession}
          disabled={isStarting}
          title="New session"
          aria-label="New omp session"
          className={cn(
            "w-6 h-6 p-0",
            isStarting && "text-[var(--color-accent)]"
          )}
        >
          {isStarting ? <SpinIcon /> : <PlusIcon />}
        </Button>

        <Button
          variant="ghost"
          onClick={() => loadSessions()}
          title="Refresh (⌘R)"
          aria-label="Refresh sessions"
          className="w-6 h-6 p-0"
        >
          {isLoading ? (
            <SpinIcon />
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2" />
              <path d="M13.5 2.5v2.2H11.3" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
