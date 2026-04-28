import type { Components } from "hast-util-to-jsx-runtime";
import type { Element as HastElement } from "hast";

// 시그니처는 baseline 부분형 그대로 유지 (hast ElementContent 강제 시 9개 test fixture 가
// tagName/children 필수 위반 → strict TS 깨짐)
type HastChild = {
  type: string;
  properties?: {
    className?: string[];
    "data-language"?: string;
    [key: string]: unknown;
  };
};
import Image from "next/image";
import { CodeCard } from "../CodeCard";
import { Mermaid } from "../Mermaid";
import { resolveMarkdownLink } from "@/lib/resolve-markdown-link";
import {
  extractRawText,
  findChildText,
  findCodeProp,
} from "@/lib/markdown";

// ==================================================
// Mermaid helper — data-language 기반 (rehype-pretty-code 적용 후)
// ==================================================

/**
 * ISSUE-001 regression guard.
 * rehype-pretty-code 이전: children 의 code.language-mermaid className 검사.
 * rehype-pretty-code 이후: pre 의 data-language 속성 검사.
 * 두 방식 모두 지원하므로 회귀 테스트는 그대로 통과.
 *
 * 시그니처는 baseline 부분형 그대로 유지 (HastElement 강제 시 9개 test fixture 가
 * tagName/type 필수 위반 → strict TS 깨짐).
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
// createMarkdownComponents factory
// ==================================================

export function createMarkdownComponents(basePath: string): Partial<Components> {
  return {
    // --------------------------------------------------
    // figure — rehype-pretty-code 가 wrap 한 figure 처리
    // --------------------------------------------------
    figure: ({ children, node, ...props }) => {
      const hastNode = node as HastElement | undefined;
      const isPrettyCodeFigure =
        hastNode?.properties?.["data-rehype-pretty-code-figure"] !== undefined;

      if (!isPrettyCodeFigure || !hastNode) {
        return <figure {...props}>{children}</figure>;
      }

      const language = findCodeProp(hastNode, "data-language");

      // mermaid 블록 → raw text 추출 후 Mermaid 컴포넌트로 라우팅
      if (language === "mermaid") {
        const chartText = extractRawText(hastNode).trim();
        return <Mermaid chart={chartText} />;
      }

      const filename = findChildText(hastNode, "figcaption") ?? undefined;
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
      if (
        isMermaidPreNode(
          node as { children?: HastChild[]; properties?: Record<string, unknown> },
        )
      ) {
        return <>{children}</>;
      }
      // pretty-code 가 처리한 pre 는 figure 핸들러에서 이미 처리됨.
      return <pre {...props}>{children}</pre>;
    },

    // --------------------------------------------------
    // code — inline code (bypassInlineCode:true 로 pretty-code 미처리)
    // --------------------------------------------------
    code: ({ className, children, ...props }) => {
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
        isRelativeMd && basePath && href
          ? resolveMarkdownLink(href, basePath)
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
    img: ({ src, alt }) => {
      if (typeof src !== "string" || !src) return null;
      return (
        <Image
          src={src}
          alt={alt || ""}
          width={0}
          height={0}
          sizes="100vw"
          className="my-4 rounded-lg shadow-lg w-full h-auto"
        />
      );
    },
    hr: ({ ...props }) => (
      <hr className="my-8 border-gray-200 dark:border-gray-800" {...props} />
    ),
  };
}
