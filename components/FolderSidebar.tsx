"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Folder, FolderOpen, FileText, X } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface PostSummary {
  path: string;
  title: string;
}

interface FolderNode {
  name: string;
  path: string;
  isPost: boolean;
  postPath?: string;
  children: FolderNode[];
}

interface FolderSidebarProps {
  folderPaths: string[][];
  posts: PostSummary[];
  categoryIcons?: Record<string, string>;
}

function buildTree(folderPaths: string[][], posts: PostSummary[]): FolderNode[] {
  const root: FolderNode[] = [];

  // 폴더 노드 삽입 헬퍼
  function ensureFolder(parts: string[]): FolderNode {
    let currentLevel = root;
    let cumulativePath = "";
    let node: FolderNode | undefined;

    for (const part of parts) {
      cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
      node = currentLevel.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: cumulativePath, isPost: false, children: [] };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    }

    return node!;
  }

  // 모든 폴더 경로 삽입
  for (const parts of folderPaths) {
    if (parts.length > 0) ensureFolder(parts);
  }

  // 포스트 삽입 (leaf node)
  for (const post of posts) {
    const parts = post.path.split("/");
    const fileName = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);

    if (folderParts.length > 0) {
      const parentNode = ensureFolder(folderParts);
      const alreadyExists = parentNode.children.some((n) => n.postPath === post.path);
      if (!alreadyExists) {
        parentNode.children.push({
          name: post.title || fileName,
          path: post.path,
          isPost: true,
          postPath: post.path,
          children: [],
        });
      }
    } else {
      const alreadyExists = root.some((n) => n.postPath === post.path);
      if (!alreadyExists) {
        root.push({
          name: post.title || fileName,
          path: post.path,
          isPost: true,
          postPath: post.path,
          children: [],
        });
      }
    }
  }

  return root;
}

function FolderTreeNode({
  node,
  depth,
  currentPath,
  icons,
  onNavigate,
}: {
  node: FolderNode;
  depth: number;
  currentPath: string;
  icons: Record<string, string>;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  if (node.isPost) {
    const href = `/posts/${node.postPath}`;
    const isActive = currentPath === href;
    return (
      <li>
        <Link
          href={href}
          onClick={onNavigate}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs transition-colors ${
            isActive
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
              : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </Link>
      </li>
    );
  }

  const href = `/category/${node.path}`;
  const isActive = currentPath === href || currentPath.startsWith(href + "/");
  const icon = depth === 0 ? (icons[node.name] ?? "📁") : null;

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
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
            onClick={onNavigate}
            className={`flex items-center gap-1.5 flex-1 py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              isActive ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : ""
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
            onClick={onNavigate}
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
              key={child.isPost ? `post-${child.postPath}` : child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              icons={icons}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderSidebar({ folderPaths, posts, categoryIcons = {} }: FolderSidebarProps) {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const tree = buildTree(folderPaths, posts);

  // 경로 변경 시 drawer 닫기
  useEffect(() => {
    close();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={close}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            카테고리
          </p>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="사이드바 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tree */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <FolderTreeNode
                key={node.isPost ? `post-${node.postPath}` : node.path}
                node={node}
                depth={0}
                currentPath={pathname}
                icons={categoryIcons}
                onNavigate={close}
              />
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
