/**
 * @module components/Sidebar/SearchBar
 * Search input for filtering sessions.
 * ⌘F focuses it from anywhere in the app (via `useKeyboard` in the sidebar).
 */
import { useRef } from "react";

import { Input } from "@/components/ui";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useSessionStore } from "@/store/sessions";

/** Magnifier icon for left slot. */
function SearchIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="m10 10 3 3" />
    </svg>
  );
}

/** Clear (×) button rendered in right slot when query is non-empty. */
function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      aria-label="Clear search"
      className="text-[var(--color-ink-7)] hover:text-[var(--color-ink-1)] transition-colors"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

/** Sidebar search field — filters session list as the user types. */
export default function SearchBar() {
  const { searchQuery, setSearch } = useSessionStore();
  const ref = useRef<HTMLInputElement>(null);

  // ⌘F → focus search input
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
    <Input
      ref={ref}
      type="search"
      value={searchQuery}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search… (⌘F)"
      aria-label="Search sessions"
      leftIcon={<SearchIcon />}
      rightSlot={searchQuery ? <ClearButton onClear={() => setSearch("")} /> : undefined}
    />
  );
}
