"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrettyCode, {
  type Options as PrettyCodeOptions,
} from "rehype-pretty-code";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import type { Components } from "react-markdown";
import type { Element as HastElement } from "hast";
import Image from "next/image";
import { Mermaid } from "./Mermaid";
import { CodeCard } from "./CodeCard";
import { resolveMarkdownLink } from "@/lib/resolve-markdown-link";
import {
  extractRawText,
  findChildText,
  findCodeProp,
} from "@/lib/markdown";

// ==================================================
// Mermaid helper — data-language 기반 (rehype-pretty-code 적용 후)
// ==================================================

type HastChild = {
  type: string;
  properties?: {
    className?: string[];
    "data-language"?: string;
    [key: string]: unknown;
  };
};

/**
 * ISSUE-001 regression guard.
 * rehype-pretty-code 이전: children 의 code.language-mermaid className 검사.
 * rehype-pretty-code 이후: pre 의 data-language 속성 검사.
 * 두 방식 모두 지원하므로 회귀 테스트는 그대로 통과.
 */
export function isMermaidPreNode(node: {
  children?: HastChild[];
  properties?: Record<string, unknown>;
}): boolean {
  // 신규: pretty-code 가 pre 에 부여하는 data-language 속성 검사
  if (node?.properties?.["data-language"] === "mermaid") return true;
  // 기존 fallback: children 의 className 검사 (레거시 호환)
  return (
    node?.children?.some(
      (child) =>
        child.type === "element" &&
        child.properties?.className?.includes("language-mermaid"),
    ) ?? false
  );
}

// ==================================================
// rehype-pretty-code 설정
// ==================================================

const PRETTY_CODE_OPTIONS: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  defaultLang: "plaintext",
  keepBackground: false, // background 는 .code-card-body 룰로 처리
  bypassInlineCode: true, // plan011 의 .prose :not(pre) > code 룰 보존
};

// ==================================================
// MarkdownRenderer 컴포넌트
// ==================================================

interface MarkdownRendererProps {
  content: string;
  basePath?: string;
}

export function MarkdownRenderer({ content, basePath }: MarkdownRendererProps) {
  const components: Partial<Components> = {
    // --------------------------------------------------
    // figure — rehype-pretty-code 가 wrap 한 figure 처리
    // --------------------------------------------------
    figure: ({ children, node, ...props }) => {
      const hastNode = node as HastElement | undefined;
      const isPrettyCodeFigure =
        hastNode?.properties?.["data-rehype-pretty-code-figure"] !== undefined;

      if (!isPrettyCodeFigure || !hastNode) {
        // 일반 figure (markdown image caption 등) 또는 hastNode 부재
        // (TypeScript 타입 좁히기용 명시 가드) — 원본 그대로 렌더
        return <figure {...props}>{children}</figure>;
      }

      const language = findCodeProp(hastNode, "data-language");

      // mermaid 블록 → raw text 추출 후 Mermaid 컴포넌트로 라우팅
      if (language === "mermaid") {
        const chartText = extractRawText(hastNode).trim();
        return <Mermaid chart={chartText} />;
      }

      const filename = findChildText(hastNode, "figcaption");
      const rawCode = extractRawText(hastNode).trim();
      const variant: "code" | "diff" | "terminal" =
        language === "diff"
          ? "diff"
          : language === "bash" ||
              language === "sh" ||
              language === "shell" ||
              language === "zsh"
            ? "terminal"
            : "code";

      return (
        <CodeCard
          filename={filename}
          language={language}
          rawCode={rawCode}
          variant={variant}
        >
          {children}
        </CodeCard>
      );
    },

    // --------------------------------------------------
    // pre — mermaid guard (pretty-code 거치지 않은 경우 대비)
    // --------------------------------------------------
    pre: ({ children, node, ...props }) => {
      if (isMermaidPreNode(node as { children?: HastChild[]; properties?: Record<string, unknown> })) {
        return <>{children}</>;
      }
      // pretty-code 가 처리한 pre 는 figure 핸들러에서 이미 처리됨.
      // 여기까지 오는 경우는 rehypeRaw 로 통과된 plain HTML pre 등.
      return <pre {...props}>{children}</pre>;
    },

    // --------------------------------------------------
    // code — inline code (bypassInlineCode:true 로 pretty-code 미처리)
    // --------------------------------------------------
    code: ({ className, children, ...props }) => {
      // inline code 는 className 없고 parent 가 pre 가 아닌 경우
      // plan011 의 .prose :not(pre) > code 룰이 적용됨 → 추가 className 불필요
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // --------------------------------------------------
    // Headings
    // --------------------------------------------------
    h1: ({ children, ...props }) => (
      <h1
        className="text-2xl md:text-4xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-800"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl md:text-3xl font-bold mt-8 mb-4" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg md:text-2xl font-bold mt-6 mb-3" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-base md:text-xl font-bold mt-4 mb-2" {...props}>
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
    img: ({ src, alt }) => (
      <Image
        src={typeof src === "string" ? src : ""}
        alt={alt || ""}
        width={0}
        height={0}
        sizes="100vw"
        className="my-4 rounded-lg shadow-lg max-w-full h-auto"
        style={{ width: "100%", height: "auto" }}
      />
    ),
    hr: ({ ...props }) => (
      <hr className="my-8 border-gray-200 dark:border-gray-800" {...props} />
    ),
  };

  return (
    <div className="prose-sm md:prose prose-gray dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypePrettyCode, PRETTY_CODE_OPTIONS], rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
