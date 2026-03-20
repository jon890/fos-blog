"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { Components } from "react-markdown";
import "highlight.js/styles/github-dark.css";
import { Mermaid } from "./Mermaid";

interface MarkdownRendererProps {
  content: string;
  basePath?: string;
}

/**
 * 마크다운의 상대경로 .md 링크를 블로그 URL로 변환
 * 예: ../other.md → /posts/category/other
 *     ./sub/post.md#section → /posts/category/sub/post#section
 */
function resolveMarkdownLink(href: string, basePath: string): string {
  const hashIdx = href.indexOf("#");
  const fragment = hashIdx !== -1 ? href.slice(hashIdx) : "";
  const linkPath = hashIdx !== -1 ? href.slice(0, hashIdx) : href;

  const pathWithoutExt = linkPath.replace(/\.mdx?$/, "");
  const baseSegments = basePath.split("/").slice(0, -1);
  const resolved = [...baseSegments];

  for (const seg of pathWithoutExt.split("/")) {
    if (seg === ".") continue;
    else if (seg === "..") resolved.pop();
    else resolved.push(seg);
  }

  return `/posts/${resolved.join("/")}${fragment}`;
}

export function MarkdownRenderer({ content, basePath }: MarkdownRendererProps) {
  const components: Partial<Components> = {
    h1: ({ children, ...props }) => (
      <h1
        className="text-3xl md:text-4xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-800"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-2xl md:text-3xl font-bold mt-8 mb-4" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-xl md:text-2xl font-bold mt-6 mb-3" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-lg md:text-xl font-bold mt-4 mb-2" {...props}>
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => (
      <p className="my-4 leading-7" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-4 ml-6 list-disc space-y-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-4 ml-6 list-decimal space-y-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-7" {...props}>
        {children}
      </li>
    ),
    a: ({ children, href, ...props }) => {
      const isExternal = href?.startsWith("http");
      const isAnchor = href?.startsWith("#");
      const isRelativeMd =
        !isExternal && !isAnchor && /\.mdx?($|#)/.test(href ?? "");

      const resolvedHref =
        isRelativeMd && basePath
          ? resolveMarkdownLink(href!, basePath)
          : href;

      return (
        <a
          href={resolvedHref}
          className="text-blue-600 dark:text-blue-400 hover:underline"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-4 pl-4 border-l-4 border-blue-500 bg-gray-50 dark:bg-gray-900 py-2 italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";

      if (language === "mermaid") {
        return <Mermaid chart={String(children).replace(/\n$/, "")} />;
      }

      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 mx-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className="my-4 p-4 rounded-lg bg-gray-900 dark:bg-gray-950 overflow-x-auto text-sm"
        {...props}
      >
        {children}
      </pre>
    ),
    table: ({ children, ...props }) => (
      <div className="my-4 overflow-x-auto">
        <table
          className="min-w-full border border-gray-200 dark:border-gray-800 rounded-lg"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-gray-50 dark:bg-gray-900" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }) => (
      <th
        className="px-4 py-2 text-left font-semibold border-b border-gray-200 dark:border-gray-800"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="px-4 py-2 border-b border-gray-200 dark:border-gray-800"
        {...props}
      >
        {children}
      </td>
    ),
    img: ({ src, alt, ...props }) => (
      <img
        src={src}
        alt={alt || ""}
        className="my-4 rounded-lg shadow-lg max-w-full h-auto"
        loading="lazy"
        {...props}
      />
    ),
    hr: ({ ...props }) => (
      <hr className="my-8 border-gray-200 dark:border-gray-800" {...props} />
    ),
  };

  return (
    <article className="prose prose-gray dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
