"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  count?: number;
  icon?: string;
}

interface FolderSidebarProps {
  folderPaths: string[][];
  categoryIcons?: Record<string, string>;
}

function buildTree(folderPaths: string[][]): FolderNode[] {
  const root: FolderNode[] = [];

  for (const parts of folderPaths) {
    if (parts.length === 0) continue;

    let currentLevel = root;
    let cumulativePath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;

      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = { name: part, path: cumulativePath, children: [] };
        currentLevel.push(existing);
      }

      currentLevel = existing.children;
    }
  }

  return root;
}

function FolderTreeNode({
  node,
  depth,
  currentPath,
  icons,
}: {
  node: FolderNode;
  depth: number;
  currentPath: string;
  icons: Record<string, string>;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const href = `/category/${node.path}`;
  const isActive = currentPath === href || currentPath.startsWith(href + "/");
  const icon = depth === 0 ? (icons[node.name] ?? "📁") : null;

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-lg transition-colors ${
          depth === 0 ? "mb-0.5" : ""
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 flex-1 text-left py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
            />
            {icon ? (
              <span className="text-base leading-none">{icon}</span>
            ) : open ? (
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            )}
            <span
              className={`text-sm font-medium truncate ${
                depth === 0
                  ? "text-gray-800 dark:text-gray-200"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {node.name}
            </span>
          </button>
        ) : (
          <Link
            href={href}
            className={`flex items-center gap-1.5 flex-1 py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              isActive
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : ""
            }`}
          >
            <span className="w-3.5 h-3.5 flex-shrink-0" />
            {icon ? (
              <span className="text-base leading-none">{icon}</span>
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            )}
            <span
              className={`text-sm truncate ${
                isActive
                  ? "font-medium"
                  : depth === 0
                    ? "font-medium text-gray-800 dark:text-gray-200"
                    : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {node.name}
            </span>
          </Link>
        )}

        {hasChildren && (
          <Link
            href={href}
            className={`py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              isActive
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            <span className="sr-only">{node.name} 페이지로 이동</span>
          </Link>
        )}
      </div>

      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              icons={icons}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderSidebar({ folderPaths, categoryIcons = {} }: FolderSidebarProps) {
  const pathname = usePathname();
  const tree = buildTree(folderPaths);

  return (
    <aside className="w-56 flex-shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mb-3">
        카테고리
      </p>
      <nav>
        <ul className="space-y-0.5">
          {tree.map((node) => (
            <FolderTreeNode
              key={node.path}
              node={node}
              depth={0}
              currentPath={pathname}
              icons={categoryIcons}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
