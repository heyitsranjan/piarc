import { useEffect, useRef, useState } from "react";

import { ChevronDown, Code2, Loader2 } from "lucide-react";

import {
  type InstalledEditor,
  listInstalledEditors,
  openFolderInEditor,
} from "@/lib/ipc";

export default function EditorLauncher({ path }: { path: string }) {
  const [editors, setEditors] = useState<InstalledEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listInstalledEditors()
      .then(setEditors)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : String(reason))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const launch = async (editor: InstalledEditor) => {
    setLaunching(editor.id);
    setError(null);
    try {
      await openFolderInEditor(editor.id, path);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLaunching(null);
    }
  };

  const unavailable = !loading && editors.length === 0;

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        disabled={loading || unavailable}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open project in editor"
        title={unavailable ? "No supported editors found" : "Open project in editor"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-6 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[10.5px]
          text-[var(--color-ink-7)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-ink-1)]
          disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Code2 size={12} />}
        <span>Open in</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Installed editors"
          className="absolute right-0 top-7 z-40 w-52 overflow-hidden rounded-[var(--radius-md)]
            border border-[var(--color-border-strong)] bg-[var(--color-bg-2)] py-1
            shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {editors.map((editor) => (
            <button
              key={editor.id}
              type="button"
              role="menuitem"
              disabled={launching !== null}
              onClick={() => void launch(editor)}
              className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[11px]
                text-[var(--color-ink-3)] hover:bg-[var(--color-bg-hover)]
                hover:text-[var(--color-ink-0)] disabled:opacity-50"
            >
              {launching === editor.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Code2 size={13} className="text-[var(--color-accent)]" />
              )}
              Open in {editor.name}
            </button>
          ))}
          {error && (
            <p
              role="alert"
              className="border-t border-[var(--color-border)] px-2.5 py-2 text-[10px] text-[var(--color-danger)]"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
