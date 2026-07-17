import type { Metadata } from "next";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  GlossaryIndex,
  type GlossaryIndexItem,
} from "@/components/glossary/GlossaryIndex";
import { env } from "@/env";
import logger from "@/lib/logger";
import { createGlossaryService, type GlossaryPageTerm } from "@/services";

const log = logger.child({ module: "app/glossary" });
const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const revalidate = 60;

export const metadata: Metadata = {
  title: "개발 용어집",
  description: "개발 블로그에 등장하는 전문 용어의 정의와 사용 문맥을 찾아보세요.",
  alternates: {
    canonical: `${siteUrl}/glossary`,
  },
  openGraph: {
    title: "개발 용어집 | FOS Study",
    description: "개발 블로그에 등장하는 전문 용어의 정의와 사용 문맥을 찾아보세요.",
    url: `${siteUrl}/glossary`,
    type: "website",
  },
};

export default async function GlossaryPage() {
  let terms: GlossaryPageTerm[] = [];

  try {
    const data = await createGlossaryService().getGlossaryPageData();
    terms = data.terms;
  } catch (error) {
    log.warn(
      {
        operation: "get-glossary-page-data",
        err: error instanceof Error ? error : new Error(String(error)),
      },
      "Failed to load glossary page data",
    );
  }

  const items = await Promise.all(terms.map(renderGlossaryItem));

  return (
    <main className="mx-auto w-full max-w-[980px] px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <header className="mb-10 border-b border-[var(--color-border-subtle)] pb-8 sm:mb-12 sm:pb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-brand-text)]">
          field notes · glossary
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-[var(--color-fg-primary)] sm:text-4xl">
              개발 용어집
            </h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[var(--color-fg-secondary)] sm:text-[15px]">
              본문에서 만난 전문 용어의 정의를 찾고, 실제로 등장한 글의 문맥까지 이어서 확인하세요.
            </p>
          </div>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
            {items.length} terms
          </span>
        </div>
      </header>

      <GlossaryIndex items={items} />
    </main>
  );
}

async function renderGlossaryItem(term: GlossaryPageTerm): Promise<GlossaryIndexItem> {
  const description = await MarkdownRenderer({
    content: term.description,
    basePath: "",
    enableGlossary: false,
  });

  return {
    metadata: {
      id: term.id,
      term: term.term,
      fullName: term.fullName,
      aliases: term.aliases,
      summary: term.summary,
    },
    description,
    references: term.references,
    mentions: term.mentions.map((mention) => ({
      pageType: mention.pageType,
      pageTitle: mention.pageTitle,
      updatedAtLabel: formatMentionDate(mention.pageUpdatedAt),
      url: mention.url,
    })),
  };
}

function formatMentionDate(value: Date | null): string | null {
  if (!value) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}
