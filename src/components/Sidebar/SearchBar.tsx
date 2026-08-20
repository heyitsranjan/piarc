/**
 * @module components/Sidebar/SearchBar
 * Compact search input for filtering sessions. ⌘F to focus.
 */
import { useRef } from "react";

import { X } from "lucide-react";

import { useKeyboard } from "@/hooks/useKeyboard";

import { useSessionStore } from "@/store/sessions";
import { useUiStore } from "@/store/ui";

import ModeDropdown from "./ModeDropdown";

export default function SearchBar() {
  const { searchQuery, setSearch } = useSessionStore();
  const sidebarMode = useUiStore((state) => state.sidebarMode);
  const label = sidebarMode === "all" ? "sessions and terminals" : sidebarMode;
  const ref = useRef<HTMLInputElement>(null);

  useKeyboard([
    {
      key: "f",
      meta: true,
      handler: () => {
        ref.current?.focus();
        ref.current?.select();
      },
    },
  ]);

  return (
    <div className="flex items-center gap-2 px-2 pb-[7px] pt-2">
      <div className="relative flex-1">
        <input
          ref={ref}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${label}`}
          aria-label={`Search ${label} (⌘F)`}
          className="h-[31px] w-full rounded-[4px] border border-[var(--color-border)]
            bg-[var(--color-bg)] px-[9px] pr-10 font-mono text-[9px] text-[var(--color-ink-1)]
            placeholder:text-[var(--color-ink-7)] focus:outline-none"
        />
        {!searchQuery && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] text-[var(--color-ink-5)]">
            ⌘ F
          </kbd>
        )}
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center
              text-[var(--color-ink-7)] transition-colors hover:text-[var(--color-ink-1)]"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      <ModeDropdown />
    </div>
  );
}
