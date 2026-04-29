import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { parseMarkdownToHast } from "./markdown/unified-pipeline";
import { createMarkdownComponents } from "./markdown/components";

interface MarkdownRendererProps {
  content: string;
  basePath: string;
}

export async function MarkdownRenderer({
  content,
  basePath,
}: MarkdownRendererProps) {
  const tree = await parseMarkdownToHast(content);
  return (
    <div className="prose prose-sm md:prose-base prose-gray dark:prose-invert max-w-none">
      {toJsxRuntime(tree, {
        Fragment,
        jsx,
        jsxs,
        passNode: true,
        components: createMarkdownComponents(basePath),
      })}
    </div>
  );
}
