/**
 * @module components/NotePanel
 * Slide-out drawer for per-session notes attached to any tab.
 */
import { useEffect, useRef } from "react";

import { X } from "lucide-react";

import { useTerminalStore } from "@/store/terminal";
import { useUiStore } from "@/store/ui";

export default function NotePanel() {
  const notePanelOpen = useUiStore((s) => s.notePanelOpen);
  const toggleNotePanel = useUiStore((s) => s.toggleNotePanel);
  const activeTab = useTerminalStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateTabNote = useTerminalStore((s) => s.updateTabNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the panel opens.
  useEffect(() => {
    if (notePanelOpen) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }, [notePanelOpen, activeTab?.id]);

  // Close on Escape.
  useEffect(() => {
    if (!notePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleNotePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notePanelOpen, toggleNotePanel]);

  if (!notePanelOpen || !activeTab) return null;

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={toggleNotePanel}
        aria-hidden
      />

      <aside
        className="fixed right-0 top-[28px] bottom-0 z-50 flex w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl"
        role="complementary"
        aria-label={`Notes for ${activeTab.title}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <span className="truncate font-mono text-[10px] font-semibold text-[var(--color-ink-1)]">
            {activeTab.title}
          </span>
          <button
            type="button"
            onClick={toggleNotePanel}
            title="Close notes (Esc)"
            aria-label="Close notes"
            className="titlebar-button"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={activeTab.note}
          onChange={(e) => updateTabNote(activeTab.id, e.target.value)}
          placeholder="Add a note for this session…"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="flex-1 resize-none bg-[var(--color-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--color-ink-0)] outline-none placeholder:text-[var(--color-ink-7)]"
          style={{ tabSize: 2 }}
          aria-label={`Note for ${activeTab.title}`}
        />
      </aside>
    </>
  );
}
