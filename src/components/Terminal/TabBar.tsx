/**
 * @module components/Terminal/TabBar
 * Horizontal tab strip above the terminal area.
 *
 * Each tab shows the session title and a close button.
 * Keyboard shortcuts: ⌘T new tab (triggers session select), ⌘W close active,
 * ⌘1-9 switch by index.
 */
import Button from "@/components/ui/Button";
import { useKeyboard } from "@/hooks/useKeyboard";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

/** The tab bar rendered above the terminal pane. */
export default function TabBar() {
  const { tabs, activeTabId, closeTab, setActiveTab } = useTerminalStore();
  const openCmdPalette = useUiStore((s) => s.openCommandPalette);

  // ⌘T → open command palette to pick a new session
  // ⌘W → close active tab
  // ⌘1-9 → switch to tab by index
  useKeyboard([
    { key: "t", meta: true, handler: openCmdPalette },
    {
      key: "w",
      meta: true,
      handler: () => {
        if (activeTabId) closeTab(activeTabId);
      },
    },
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      meta: true as const,
      handler: () => {
        const tab = tabs[i];
        if (tab) setActiveTab(tab.id);
      },
    })),
  ]);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex items-center shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-elev)] overflow-x-auto"
      style={{ height: "var(--titlebar-height)" }}
      data-tauri-drag-region
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex items-center gap-1.5 px-3 h-full",
              "cursor-pointer select-none shrink-0 max-w-48",
              "text-xs transition-colors duration-[var(--duration-fast)]",
              "border-r border-[var(--color-border-2)]",
              isActive
                ? "text-[var(--color-ink-0)] bg-[var(--color-bg)]"
                : "text-[var(--color-ink-5)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-bg-hover)]"
            )}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-px bg-[var(--color-accent)]" />
            )}

            {/* Loading dot */}
            {tab.isLoading && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
            )}

            {/* Tab title */}
            <span className="truncate">{tab.title}</span>

            {/* Close button */}
            <Button
              variant="ghost"
              aria-label={`Close tab: ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 shrink-0"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </Button>
          </div>
        );
      })}

      {/* New tab button */}
      <Button
        variant="ghost"
        title="New tab (⌘T)"
        aria-label="New terminal tab"
        onClick={openCmdPalette}
        className="px-3 h-full shrink-0"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </Button>
    </div>
  );
}
