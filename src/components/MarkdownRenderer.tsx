import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { parseMarkdownToHast } from "./markdown/unified-pipeline";
import { createMarkdownComponents } from "./markdown/components";
import { applyGlossaryTransform } from "./markdown/glossary-transform";
import type { MatchableGlossaryTerm } from "@/infra/db/repositories/GlossaryRepository";

interface MarkdownRendererProps {
  content: string;
  basePath: string;
  glossaryTerms?: MatchableGlossaryTerm[];
  enableGlossary?: boolean;
}

export async function MarkdownRenderer({
  content,
  basePath,
  glossaryTerms = [],
  enableGlossary = true,
}: MarkdownRendererProps) {
  const tree = await parseMarkdownToHast(content);
  applyGlossaryTransform(tree, glossaryTerms, enableGlossary);
  const glossaryById = new Map(glossaryTerms.map((term) => [term.id, term]));
  return (
    <div className="prose prose-sm md:prose-base prose-gray dark:prose-invert max-w-none">
      {toJsxRuntime(tree, {
        Fragment,
        jsx,
        jsxs,
        passNode: true,
        components: createMarkdownComponents(basePath, glossaryById),
      })}
    </div>
  );
}
