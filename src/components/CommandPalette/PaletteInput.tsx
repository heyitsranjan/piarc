/**
 * @module components/CommandPalette/PaletteInput
 * Auto-focused search field at the top of the command palette overlay.
 */
import { useEffect, useRef } from "react";

import { Input } from "@/components/ui";

interface PaletteInputProps {
  value: string;
  onChange: (v: string) => void;
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
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

/** Auto-focused search input. Gains focus as soon as the palette mounts. */
export default function PaletteInput({ value, onChange }: PaletteInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <Input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search sessions…"
      aria-label="Command palette search"
      leftIcon={<SearchIcon />}
      className="bg-transparent py-3 text-sm border-transparent rounded-none"
    />
  );
}
