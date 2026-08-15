/** One staged or unstaged working-tree entry returned by Tauri. */
export interface GitFileChange {
  path: string;
  oldPath: string | null;
  status: string;
  staged: boolean;
  untracked: boolean;
}

/** Repository identity and current working-tree changes. */
export interface GitChangesSnapshot {
  root: string;
  branch: string;
  files: GitFileChange[];
}

/** Stable identity for entries that may exist in both staged and unstaged groups. */
export function gitChangeKey(file: GitFileChange): string {
  return `${file.staged ? "staged" : "working"}:${file.path}`;
}
