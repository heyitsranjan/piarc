/**
 * @module components/Note
 * Plain-text note editor for note tabs.
 */
import { useEffect, useRef } from "react";

import { type NoteTab, useTerminalStore } from "@/store/terminal";

interface NoteProps {
  tab: NoteTab;
}

export default function Note({ tab }: NoteProps) {
  const { updateTabContent } = useTerminalStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
  }, [tab.id]);

  return (
    <textarea
      ref={textareaRef}
      value={tab.content}
      onChange={(event) => updateTabContent(tab.id, event.target.value)}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      className="h-full w-full resize-none bg-[var(--color-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--color-ink-0)] outline-none"
      style={{ tabSize: 2 }}
      aria-label={`Note ${tab.title}`}
    />
  );
}
