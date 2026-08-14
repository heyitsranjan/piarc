/**
 * @module components/Terminal/TerminalEmpty
 * Placeholder shown in the terminal area when no session is active.
 */

/** Empty-state for the terminal pane before any session is selected. */
export default function TerminalEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none bg-[#0f0a14]">
      <span className="text-5xl font-light" style={{ color: "oklch(22% 0.025 285)" }}>
        π
      </span>
      <p className="text-xs" style={{ color: "oklch(42% 0.02 285)" }}>
        Select a session from the sidebar
      </p>
      <div className="flex gap-4 text-[10px]" style={{ color: "oklch(28% 0.02 285)" }}>
        <span>⌘K — command palette</span>
        <span>⌘T — new tab</span>
      </div>
    </div>
  );
}
