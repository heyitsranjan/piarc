/**
 * @module components/Sidebar/SearchBar
 * Compact search input for filtering sessions. ⌘F to focus.
 */
import { Search, X } from "lucide-react";
import { useRef } from "react";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessionStore } from "@/store/sessions";

export default function SearchBar() {
  const { searchQuery, setSearch } = useSessionStore();
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
    <div className="relative px-2 pb-2">
      <span
        className="pointer-events-none absolute left-[18px] top-[8px]
        text-[var(--color-ink-7)]"
      >
        <Search size={14} strokeWidth={1.8} />
      </span>
      <input
        ref={ref}
        type="search"
        value={searchQuery}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search sessions"
        aria-label="Search sessions (⌘F)"
        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)]
          bg-[var(--color-input)] pl-8 pr-8 text-[13px] text-[var(--color-ink-1)]
          placeholder:text-[var(--color-ink-7)] focus:border-[var(--color-focus)]
          focus:outline-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label="Clear search"
          className="absolute right-3 top-0 flex size-8 items-center justify-center
            text-[var(--color-ink-7)] transition-colors hover:text-[var(--color-ink-1)]"
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
