/**
 * @module components/Sidebar/RenameDialog
 * Modal dialog for renaming an omp session.
 */
import { useEffect, useRef, useState } from "react";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

interface RenameDialogProps {
  title: string;
  subtitle: string;
  onRename: (title: string) => Promise<void> | void;
  onClose: () => void;
}

export default function RenameDialog({
  title,
  subtitle,
  onRename,
  onClose,
}: RenameDialogProps) {
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      onClose();
      return;
    }
    setSaving(true);
    await onRename(trimmed);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="arc-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Rename session"
        aria-modal
        className="arc-dialog-panel palette-panel mx-5 w-[390px] max-w-[calc(100vw-40px)] overflow-hidden border"
      >
        {/* Header */}
        <div className="arc-dialog-header flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <Pencil size={14} strokeWidth={1.8} className="text-[var(--color-ink-7)]" />
          <div>
            <h2 className="arc-dialog-title text-[var(--color-ink-0)]">Rename session</h2>
            <p className="arc-dialog-subtitle truncate">{subtitle}</p>
          </div>
        </div>

        {/* Input */}
        <div className="arc-dialog-body">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder="Session title"
            className={cn(
              "h-9 w-full rounded-[4px] border border-[var(--color-border-strong)] bg-[#101217] px-3 font-mono text-[10px] text-[var(--color-ink-0)]",
              "focus:outline-none placeholder:text-[var(--color-ink-9)]"
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-[15px] pb-[14px]">
          <button
            onClick={onClose}
            className="arc-dialog-button h-8 border border-[var(--color-border)] px-3.5 text-[var(--color-ink-5)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-1)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="arc-dialog-button h-8 bg-[var(--color-accent)] px-3.5 text-[#0a0b0e] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
