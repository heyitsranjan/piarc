/**
 * @module components/Terminal/TerminalEmpty
 * Empty state shown when no session is active.
 */
export default function TerminalEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3
      select-none bg-[var(--color-bg)]">
      <span className="text-[28px] leading-none"
        style={{ color: "var(--color-ink-9)" }}>π</span>
      <p className="text-[12px] text-[var(--color-ink-7)]">
        Select a session from the sidebar
      </p>
      <div className="flex gap-4 text-[10.5px] text-[var(--color-ink-9)]">
        <span>⌘K — command palette</span>
        <span>⌘B — toggle sidebar</span>
      </div>
    </div>
  );
}
