import { useCallback, useEffect, useState } from "react";

import type { OmpPathSuggestion } from "@/lib/ipc";
import { listWorkspaceEntries, readWorkspaceFile } from "@/lib/ipc";

/** Load an ignore-aware project tree and one selected text file while Explorer is open. */
export function useWorkspaceExplorer(cwd: string | undefined, open: boolean) {
  const [entries, setEntries] = useState<OmpPathSuggestion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cwd || !open) return;
    setLoadingEntries(true);
    try {
      const next = await listWorkspaceEntries(cwd);
      setEntries(next);
      setSelected((current) =>
        current && next.some((entry) => !entry.isDirectory && entry.path === current)
          ? current
          : null
      );
      setError(null);
    } catch (cause) {
      setEntries([]);
      setSelected(null);
      setContent("");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingEntries(false);
    }
  }, [cwd, open]);

  useEffect(() => {
    setEntries([]);
    setSelected(null);
    setContent("");
    setError(null);
    if (cwd && open) void refresh();
  }, [cwd, open, refresh]);

  useEffect(() => {
    if (!cwd || !open || !selected) {
      setContent("");
      return;
    }

    let current = true;
    setLoadingContent(true);
    setError(null);
    readWorkspaceFile(cwd, selected)
      .then((value) => {
        if (current) setContent(value);
      })
      .catch((cause) => {
        if (current) {
          setContent("");
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (current) setLoadingContent(false);
      });

    return () => {
      current = false;
    };
  }, [cwd, open, selected]);

  return {
    entries,
    selected,
    content,
    loadingEntries,
    loadingContent,
    error,
    refresh,
    selectFile: setSelected,
  };
}
