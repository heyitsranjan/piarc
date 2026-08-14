/**
 * @module components/Sidebar/SidebarHeader
 * Top bar of the sidebar: title + New Session button + refresh.
 *
 * "New Session" spawns a fresh `omp` process (no --resume).
 * The session file omp creates will appear in the sidebar automatically
 * via the FS watcher.
 */
import Button from "@/components/ui/Button";
import { useNewSession } from "@/hooks/useNewSession";
import { useSessionStore } from "@/store/sessions";

function SpinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      className="animate-spin">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.2" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2" />
      <path d="M13.5 2.5v2.2H11.3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** Sidebar title bar with drag region, new-session, and refresh buttons. */
export default function SidebarHeader() {
  const { isLoading, loadSessions, sessions } = useSessionStore();
  const { startNewSession, isStarting } = useNewSession();

  return (
    <div
      className="flex items-center justify-between px-3 shrink-0"
      style={{ height: "var(--titlebar-height)", paddingLeft: 80 }}
      data-tauri-drag-region
    >
      {/* Title + count */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-ink-5)] text-[11px] font-semibold tracking-widest uppercase">
          Sessions
        </span>
        {sessions.length > 0 && (
          <span className="text-[10px] text-[var(--color-ink-9)] tabular-nums">
            {sessions.length}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {/* New session */}
        <Button
          onClick={startNewSession}
          title="New omp session"
          aria-label="Start new omp session"
          disabled={isStarting}
          variant="ghost"
        >
          {isStarting ? <SpinIcon /> : <PlusIcon />}
        </Button>

        {/* Refresh */}
        <Button
          onClick={() => loadSessions()}
          title="Refresh sessions (⌘R)"
          aria-label="Refresh sessions"
          variant="ghost"
        >
          {isLoading ? <SpinIcon /> : <RefreshIcon />}
        </Button>
      </div>
    </div>
  );
}
