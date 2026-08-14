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

  useKeyboard([{
    key: "f", meta: true,
    handler: () => { ref.current?.focus(); ref.current?.select(); },
  }]);

  return (
    <div className="relative px-2 pb-2">
      <span className="absolute left-4 top-1/2 -translate-y-[calc(50%+4px)]
        text-[var(--color-ink-9)] pointer-events-none">
        <Search size={11} strokeWidth={2} />
      </span>
      <input
        ref={ref}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        aria-label="Search sessions (⌘F)"
        className="w-full h-[28px] pl-[26px] pr-6 text-[12px]
          bg-[var(--color-bg-hover)] text-[var(--color-ink-1)]
          placeholder:text-[var(--color-ink-9)]
          border border-[var(--color-border)] rounded-[var(--radius-sm)]
          focus:outline-none focus:border-[var(--color-accent)]
          transition-colors duration-[var(--duration-fast)]"
      />
      {searchQuery && (
        <button
          onClick={() => setSearch("")}
          aria-label="Clear search"
          className="absolute right-4 top-1/2 -translate-y-[calc(50%+4px)]
            text-[var(--color-ink-9)] hover:text-[var(--color-ink-5)]
            transition-colors"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
