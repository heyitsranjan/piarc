/**
 * @module components/Sidebar/SidebarHeader
 * Top bar of the sidebar panel: title, session count, refresh button.
 * The New Session action moved to the main TitleBar.
 */
import Button from "@/components/ui/Button";
import { useSessionStore } from "@/store/sessions";

function SpinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      className="animate-spin">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.2" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2" />
      <path d="M13.5 2.5v2.2H11.3" />
    </svg>
  );
}

/** Sidebar panel header — title, count badge, refresh. */
export default function SidebarHeader() {
  const { isLoading, loadSessions, sessions } = useSessionStore();

  return (
    <div className="flex items-center justify-between px-3 py-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-semibold tracking-widest uppercase
          text-[var(--color-ink-7)]">
          Sessions
        </span>
        {sessions.length > 0 && (
          <span className="text-[10px] tabular-nums text-[var(--color-ink-9)]
            bg-[var(--color-bg-2)] px-1.5 py-0.5 rounded-full">
            {sessions.length}
          </span>
        )}
      </div>

      <Button
        onClick={() => loadSessions()}
        title="Refresh (⌘R)"
        aria-label="Refresh sessions"
        variant="ghost"
        className="p-1"
      >
        {isLoading ? <SpinIcon /> : <RefreshIcon />}
      </Button>
    </div>
  );
}
