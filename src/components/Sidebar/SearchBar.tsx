/**
 * @module components/Sidebar/SearchBar
 * Compact search input for filtering sessions. ⌘F to focus.
 */
import { useRef } from "react";

import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessionStore } from "@/store/sessions";

function SearchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="m10 10 3 3" />
    </svg>
  );
}

export default function SearchBar() {
  const { searchQuery, setSearch } = useSessionStore();
  const ref = useRef<HTMLInputElement>(null);

  useKeyboard([
    {
      key: "f", meta: true,
      handler: () => { ref.current?.focus(); ref.current?.select(); },
    },
  ]);

  return (
    <div className="relative flex items-center px-2 pb-2">
      <span className="absolute left-4 text-[var(--color-ink-9)] pointer-events-none">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        aria-label="Search sessions (⌘F)"
        className="w-full h-7 pl-7 pr-2.5 text-[12px]
          bg-[var(--color-bg-hover)] text-[var(--color-ink-1)]
          placeholder:text-[var(--color-ink-9)]
          border border-[var(--color-border)] rounded-[var(--radius-sm)]
          focus:outline-none focus:border-[var(--color-accent)]
          transition-colors duration-[var(--duration-fast)]"
      />
      {searchQuery && (
        <button
          onClick={() => setSearch("")}
          className="absolute right-4 text-[var(--color-ink-9)]
            hover:text-[var(--color-ink-5)] transition-colors"
          aria-label="Clear search"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
