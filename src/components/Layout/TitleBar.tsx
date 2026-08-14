/**
 * @module components/Layout/TitleBar
 * Invisible drag region spanning the full window width above the content.
 * On macOS the native traffic-light buttons sit in this region.
 * Windows/Linux get a minimal custom title bar with app name + window controls.
 */
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";

/** Detects the current OS from the user agent. */
function getOS(): "mac" | "win" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "win";
  return "linux";
}

/** Full-width titlebar drag region. macOS: transparent. Win/Linux: shows app name. */
export default function TitleBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const os = getOS();

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex items-center shrink-0 w-full select-none",
        "border-b border-[var(--color-border-2)]"
      )}
      style={{ height: "var(--titlebar-height)" }}
    >
      {/* macOS: leave traffic lights room, nothing else needed */}
      {os === "mac" && <div style={{ width: 80 }} className="shrink-0" />}

      {/* Win / Linux: show app name centred */}
      {os !== "mac" && (
        <span className="flex-1 text-center text-xs text-[var(--color-ink-7)] font-medium">
          Oh My Pi
        </span>
      )}

      {/* Sidebar toggle — visible on all platforms */}
      <button
        data-tauri-drag-region="false"
        onClick={toggleSidebar}
        title="Toggle sidebar (⌘B)"
        className="px-3 text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)] transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M6 2v12" />
        </svg>
      </button>
    </div>
  );
}
