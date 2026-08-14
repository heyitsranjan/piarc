/**
 * @module components/Sidebar/RenameDialog
 * Modal dialog for renaming an omp session.
 * Opens pre-filled with the current title; Enter/Save commits the rename.
 */
import { useEffect, useRef, useState } from "react";

import type { OmpSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/sessions";

interface RenameDialogProps {
  session:  OmpSession;
  onClose:  () => void;
}

/**
 * Centered modal for renaming a session.
 * Calls `renameSession` from the store on confirm.
 */
export default function RenameDialog({ session, onClose }: RenameDialogProps) {
  const [value,  setValue]  = useState(session.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { renameSession } = useSessionStore();

  // Auto-focus + select all on open
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === session.title) { onClose(); return; }
    setSaving(true);
    await renameSession(session.path, trimmed);
    setSaving(false);
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog card */}
      <div
        role="dialog"
        aria-label="Rename session"
        aria-modal
        className="w-full max-w-sm mx-4 bg-[var(--color-bg-elev)]
          border border-[var(--color-border)]
          rounded-[var(--radius-lg)] shadow-2xl overflow-hidden
          palette-panel"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border-2)]">
          <h2 className="text-sm font-semibold text-[var(--color-ink-0)]">
            Rename session
          </h2>
          <p className="text-[10.5px] text-[var(--color-ink-7)] mt-0.5 truncate font-mono">
            {session.path.split("/").slice(-2).join("/")}
          </p>
        </div>

        {/* Input */}
        <div className="px-4 py-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  handleSave();
              if (e.key === "Escape") onClose();
            }}
            placeholder="Session title"
            className={cn(
              "w-full px-3 py-2 text-sm rounded-[var(--radius-sm)]",
              "bg-[var(--color-bg-2)] text-[var(--color-ink-0)]",
              "border border-[var(--color-border)]",
              "focus:outline-none focus:border-[var(--color-accent)]",
              "placeholder:text-[var(--color-ink-7)]",
              "transition-colors"
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)]
              text-[var(--color-ink-5)] hover:text-[var(--color-ink-1)]
              border border-[var(--color-border)] hover:border-[var(--color-border)]
              transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className={cn(
              "px-3 py-1.5 text-xs rounded-[var(--radius-sm)]",
              "bg-[var(--color-accent)] text-white font-medium",
              "hover:opacity-90 active:opacity-75 transition-opacity",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
