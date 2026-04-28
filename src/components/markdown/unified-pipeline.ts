import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypePrettyCode from "rehype-pretty-code";
import type { Root as HastRoot } from "hast";
import { PRETTY_CODE_OPTIONS } from "./pretty-code-options";

// unified().use()... 의 실제 반환 타입을 그대로 캡처 (Processor 제네릭 파라미터 수동 지정 회피)
async function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypePrettyCode, PRETTY_CODE_OPTIONS);
}

type UnifiedProcessor = Awaited<ReturnType<typeof buildProcessor>>;

// module-level singleton — 다중 동시 요청 시 race 방지 (Promise 자체 공유)
let processorPromise: Promise<UnifiedProcessor> | null = null;

function getProcessor(): Promise<UnifiedProcessor> {
  if (!processorPromise) {
    processorPromise = buildProcessor();
  }
  return processorPromise;
}

export async function parseMarkdownToHast(markdown: string): Promise<HastRoot> {
  const processor = await getProcessor();
  const tree = await processor.run(processor.parse(markdown));
  return tree as HastRoot;
}
