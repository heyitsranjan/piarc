/**
 * @module components/NotePanel
 * Slide-out drawer for per-session notes attached to any tab.
 */
import { useEffect, useRef } from "react";

import { StickyNote, X } from "lucide-react";

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
        className="fixed right-0 top-[28px] bottom-0 z-50 flex w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-[-16px_0_32px_rgba(0,0,0,0.28)]"
        role="complementary"
        aria-label={`Notes for ${activeTab.title}`}
      >
        <header className="arc-workspace-header">
          <StickyNote size={14} strokeWidth={1.8} className="arc-workspace-icon" />
          <div className="arc-workspace-heading">
            <p className="arc-workspace-title">Notes</p>
            <p className="arc-workspace-path" title={activeTab.title}>
              {activeTab.title}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleNotePanel}
            title="Close notes (Esc)"
            aria-label="Close notes"
            className="arc-workspace-action"
          >
            <X size={13} />
          </button>
        </header>

        <textarea
          ref={textareaRef}
          value={activeTab.note ?? ""}
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
