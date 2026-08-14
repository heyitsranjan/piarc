/**
 * @module components/Layout/TitleBar
 * Application title bar — drag region + IDE-style panel toggle.
 *
 * Layout (left → right):
 *  [← 80px traffic lights →] [panel toggle] [Oh My Pi] ──drag──
 *  [active session chip] [+ New Session]
 *
 * Panel toggle icon shows the sidebar's open/closed state visually:
 * a small rectangle split into a narrow left panel + wide content area,
 * with the left panel filled when open, outlined when collapsed.
 */
import { useNewSession } from "@/hooks/useNewSession";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

// ─── Icons ────────────────────────────────────────────────────────────────

/** Panel-open icon: filled sidebar strip + content area. */
function PanelOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {/* Outer frame */}
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5"
        stroke="currentColor" strokeWidth="1.25" />
      {/* Vertical divider */}
      <line x1="5.5" y1="2.5" x2="5.5" y2="13.5"
        stroke="currentColor" strokeWidth="1.25" />
      {/* Filled sidebar strip */}
      <rect x="1.5" y="2.5" width="4" height="11" rx="1.5"
        fill="currentColor" opacity="0.9" />
      {/* Content lines */}
      <line x1="7.5" y1="6" x2="13" y2="6"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <line x1="7.5" y1="8.5" x2="11" y2="8.5"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

/** Panel-closed icon: outlined frame only, no filled sidebar. */
function PanelClosedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {/* Outer frame */}
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5"
        stroke="currentColor" strokeWidth="1.25" />
      {/* Vertical divider (dashed = hidden panel) */}
      <line x1="5.5" y1="2.5" x2="5.5" y2="13.5"
        stroke="currentColor" strokeWidth="1.25" strokeDasharray="2 1.5" opacity="0.4"/>
      {/* Content lines shifted to full width */}
      <line x1="3" y1="6" x2="13" y2="6"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <line x1="3" y1="8.5" x2="10" y2="8.5"
        stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export default function TitleBar() {
  const sidebarCollapsed  = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar     = useUiStore((s) => s.toggleSidebar);
  const activeSession     = useSessionStore((s) => s.activeSession);
  const { startNewSession, isStarting } = useNewSession();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center shrink-0 w-full select-none
        border-b border-[var(--color-border-2)] bg-[var(--color-bg-elev)]"
      style={{ height: "var(--titlebar-height)" }}
    >
      {/* ── Left: traffic-light offset + panel toggle + app name ─────────── */}
      <div className="flex items-center gap-1 shrink-0" style={{ paddingLeft: 76 }}>
        {/* Panel toggle — primary affordance */}
        <button
          data-tauri-drag-region="false"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Show sidebar (⌘B)" : "Hide sidebar (⌘B)"}
          aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)]",
            "transition-colors duration-[var(--duration-fast)]",
            sidebarCollapsed
              ? "text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)]"
              : "text-[var(--color-accent)] bg-[var(--color-accent-dim)] hover:opacity-80"
          )}
        >
          {sidebarCollapsed ? <PanelClosedIcon /> : <PanelOpenIcon />}
        </button>

        {/* App name — subtle, not competing with content */}
        <span className="text-[11px] font-medium text-[var(--color-ink-7)] pl-1 tracking-wide">
          Oh My Pi
        </span>
      </div>

      {/* ── Center: drag region ──────────────────────────────────────────── */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* ── Right: active session chip + new session ─────────────────────── */}
      <div
        className="flex items-center gap-1.5 pr-3 shrink-0"
        data-tauri-drag-region="false"
      >
        {/* Active session name chip */}
        {activeSession?.id && (
          <div className="flex items-center gap-1.5 px-2.5 py-1
            rounded-full text-[10.5px] font-medium
            bg-[var(--color-bg-2)] text-[var(--color-ink-5)]
            border border-[var(--color-border-2)]
            max-w-48 overflow-hidden"
          >
            {/* Live indicator dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0
              animate-pulse" />
            <span className="truncate">{activeSession.title}</span>
          </div>
        )}

        {/* New session button */}
        <button
          onClick={startNewSession}
          disabled={isStarting}
          title="New omp session"
          aria-label="Start new omp session"
          className={cn(
            "flex items-center gap-1.5 px-2.5 h-7",
            "rounded-[var(--radius-sm)] text-[11px] font-medium",
            "border border-[var(--color-border)]",
            "transition-colors duration-[var(--duration-fast)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "text-[var(--color-ink-1)] hover:text-[var(--color-ink-0)]",
            "hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border)]"
          )}
        >
          <PlusIcon />
          <span>New session</span>
        </button>
      </div>
    </div>
  );
}
