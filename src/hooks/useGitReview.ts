import { useCallback, useEffect, useState } from "react";

import type { GitChangesSnapshot, GitFileChange } from "@/lib/git";
import { gitChangeKey } from "@/lib/git";
import { getGitChanges, getGitFileDiff } from "@/lib/ipc";

const REFRESH_INTERVAL_MS = 3000;

/** Load repository changes and the selected file patch while the review workspace is open. */
export function useGitReview(cwd: string | undefined, open: boolean) {
  const [snapshot, setSnapshot] = useState<GitChangesSnapshot | null>(null);
  const [selected, setSelected] = useState<GitFileChange | null>(null);
  const [patch, setPatch] = useState("");
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingPatch, setLoadingPatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cwd || !open) return;
    setLoadingChanges(true);
    try {
      const next = await getGitChanges(cwd);
      setSnapshot(next);
      setError(null);
      setSelected((current) => {
        if (!current) return null;
        const key = gitChangeKey(current);
        return next.files.find((file) => gitChangeKey(file) === key) ?? null;
      });
    } catch (cause) {
      setSnapshot(null);
      setSelected(null);
      setPatch("");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingChanges(false);
    }
  }, [cwd, open]);

  useEffect(() => {
    setSnapshot(null);
    setSelected(null);
    setPatch("");
    setError(null);
    if (!cwd || !open) return;

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cwd, open, refresh]);

  useEffect(() => {
    if (!cwd || !open || !selected) {
      setPatch("");
      return;
    }

    let current = true;
    setLoadingPatch(true);
    getGitFileDiff(cwd, selected.path, selected.staged, selected.untracked)
      .then((value) => {
        if (current) setPatch(value);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (current) setLoadingPatch(false);
      });

    return () => {
      current = false;
    };
  }, [cwd, open, selected]);

  return {
    snapshot,
    selected,
    patch,
    loadingChanges,
    loadingPatch,
    error,
    refresh,
    selectFile: setSelected,
  };
}
