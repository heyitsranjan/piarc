import { useMemo, useState } from "react";

import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";

import type { GitFileChange } from "@/lib/git";
import { gitChangeKey } from "@/lib/git";
import { cn } from "@/lib/utils";

import { type GitTreeNode, buildGitTree } from "./tree";

interface FileTreeProps {
  files: GitFileChange[];
  selected: GitFileChange | null;
  onSelect: (file: GitFileChange) => void;
}

export default function FileTree({ files, selected, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildGitTree(files), [files]);

  if (tree.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-[var(--color-ink-7)]">
        Working tree clean
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Changed files" className="py-1">
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selected={selected}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps extends Pick<FileTreeProps, "selected" | "onSelect"> {
  node: GitTreeNode;
  depth: number;
}

function TreeNode({ node, selected, onSelect, depth }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isFile = node.kind === "file";
  const active = Boolean(
    isFile &&
    node.change &&
    selected &&
    gitChangeKey(node.change) === gitChangeKey(selected)
  );
  const left = 8 + depth * 14;

  if (isFile && node.change) {
    return (
      <button
        type="button"
        role="treeitem"
        aria-selected={active}
        title={node.path}
        onClick={() => onSelect(node.change!)}
        className={cn(
          "flex h-7 w-full min-w-0 items-center gap-1.5 pr-2 text-left text-[11px]",
          "text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]",
          active && "bg-[var(--color-bg-active)] text-[var(--color-ink-0)]"
        )}
        style={{ paddingLeft: left }}
      >
        <span className="w-[13px] shrink-0" />
        <FileCode2
          size={13}
          strokeWidth={1.7}
          className="shrink-0 text-[var(--color-ink-7)]"
        />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <Status status={node.change.status} />
      </button>
    );
  }

  return (
    <div role="treeitem" aria-expanded={open}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-7 w-full min-w-0 items-center gap-1.5 pr-2 text-left",
          "text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]",
          node.kind === "group" && "font-medium text-[var(--color-ink-1)]"
        )}
        style={{ paddingLeft: left }}
      >
        <ChevronRight
          size={13}
          strokeWidth={1.8}
          className={cn("shrink-0 transition-transform", open && "rotate-90")}
        />
        {node.kind === "directory" &&
          (open ? (
            <FolderOpen size={13} strokeWidth={1.7} className="shrink-0" />
          ) : (
            <Folder size={13} strokeWidth={1.7} className="shrink-0" />
          ))}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {node.kind === "group" && (
          <span className="tabular-nums text-[10px] text-[var(--color-ink-9)]">
            {countFiles(node)}
          </span>
        )}
      </button>
      {open && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const color =
    status === "A" || status === "?"
      ? "text-[var(--color-success)]"
      : status === "D"
        ? "text-[var(--color-danger)]"
        : status === "R"
          ? "text-[var(--color-info)]"
          : "text-[var(--color-warn)]";
  return (
    <span className={cn("w-3 shrink-0 text-center text-[10px] font-semibold", color)}>
      {status}
    </span>
  );
}

function countFiles(node: GitTreeNode): number {
  if (node.kind === "file") return 1;
  return node.children.reduce((total, child) => total + countFiles(child), 0);
}
