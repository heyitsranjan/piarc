import type { GitFileChange } from "@/lib/git";

export interface GitTreeNode {
  id: string;
  name: string;
  path: string;
  kind: "group" | "directory" | "file";
  children: GitTreeNode[];
  change?: GitFileChange;
}

/** Convert flat Git paths into staged and working-tree directory hierarchies. */
export function buildGitTree(files: GitFileChange[]): GitTreeNode[] {
  const groups = [
    buildGroup(
      "staged",
      "Staged Changes",
      files.filter((file) => file.staged)
    ),
    buildGroup(
      "working",
      "Changes",
      files.filter((file) => !file.staged)
    ),
  ];
  return groups.filter((group) => group.children.length > 0);
}

function buildGroup(id: string, name: string, files: GitFileChange[]): GitTreeNode {
  const root: GitTreeNode = { id, name, path: "", kind: "group", children: [] };

  for (const change of files) {
    const parts = change.path.split("/").filter(Boolean);
    let parent = root;
    let currentPath = "";

    for (const [index, part] of parts.entries()) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = parent.children.find(
        (child) => child.name === part && child.kind === (isFile ? "file" : "directory")
      );
      if (!node) {
        node = {
          id: `${id}:${currentPath}`,
          name: part,
          path: currentPath,
          kind: isFile ? "file" : "directory",
          children: [],
          change: isFile ? change : undefined,
        };
        parent.children.push(node);
      }
      parent = node;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: GitTreeNode) {
  node.children.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    if (a.kind === "directory") return -1;
    if (b.kind === "directory") return 1;
    return 0;
  });
  node.children.forEach(sortTree);
}
