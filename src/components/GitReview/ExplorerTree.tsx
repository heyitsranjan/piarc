import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";

import type { OmpPathSuggestion } from "@/lib/ipc";
import { cn } from "@/lib/utils";

interface ExplorerNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: ExplorerNode[];
}

interface ExplorerTreeProps {
  entries: OmpPathSuggestion[];
  selected: string | null;
  onSelect: (path: string) => void;
}

export default function ExplorerTree({ entries, selected, onSelect }: ExplorerTreeProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);

  if (tree.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-[var(--color-ink-7)]">
        No project files found
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Project files" className="py-1">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selected={selected}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: ExplorerNode;
  selected: string | null;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const active = !node.isDirectory && selected === node.path;
  const left = 8 + depth * 14;

  if (!node.isDirectory) {
    return (
      <button
        type="button"
        role="treeitem"
        aria-selected={active}
        title={node.path}
        onClick={() => onSelect(node.path)}
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
      </button>
    );
  }

  return (
    <div role="treeitem" aria-expanded={open}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-full min-w-0 items-center gap-1.5 pr-2 text-left text-[11px]
          text-[var(--color-ink-5)] hover:bg-[var(--color-bg-hover)]"
        style={{ paddingLeft: left }}
      >
        <ChevronRight
          size={13}
          strokeWidth={1.8}
          className={cn("shrink-0 transition-transform", open && "rotate-90")}
        />
        {open ? (
          <FolderOpen size={13} strokeWidth={1.7} className="shrink-0" />
        ) : (
          <Folder size={13} strokeWidth={1.7} className="shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      {open && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
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

function buildTree(entries: OmpPathSuggestion[]): ExplorerNode[] {
  const roots: ExplorerNode[] = [];
  const byPath = new Map<string, ExplorerNode>();

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let siblings = roots;
    let currentPath = "";

    parts.forEach((name, index) => {
      currentPath = currentPath ? `${currentPath}/${name}` : name;
      let node = byPath.get(currentPath);
      if (!node) {
        node = {
          name,
          path: currentPath,
          isDirectory: index < parts.length - 1 || entry.isDirectory,
          children: [],
        };
        byPath.set(currentPath, node);
        siblings.push(node);
      }
      siblings = node.children;
    });
  }

  sortNodes(roots);
  return roots;
}

function sortNodes(nodes: ExplorerNode[]) {
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => sortNodes(node.children));
}
