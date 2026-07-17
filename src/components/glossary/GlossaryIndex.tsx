"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

const KOREAN_INITIALS = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const ENGLISH_INITIALS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index),
);
const INDEX_ORDER: readonly string[] = [...KOREAN_INITIALS, ...ENGLISH_INITIALS];
const INITIAL_MENTION_COUNT = 5;

export type GlossarySearchMetadata = {
  id: string;
  term: string;
  fullName: string | null;
  aliases: string[];
  summary: string;
};

export type GlossaryMentionView = {
  pageType: "post" | "category-readme";
  pageTitle: string;
  updatedAtLabel: string | null;
  url: string;
};

export type GlossaryReferenceView = {
  label: string;
  url: string;
};

export type GlossaryIndexItem = {
  metadata: GlossarySearchMetadata;
  description: ReactNode;
  mentions: GlossaryMentionView[];
  references: GlossaryReferenceView[];
};

type GlossaryIndexProps = {
  items: GlossaryIndexItem[];
};

export function GlossaryIndex({ items }: GlossaryIndexProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visibleItems = useMemo(() => {
    const filteredItems = normalizedQuery
      ? items.filter(({ metadata }) =>
          [
            metadata.term,
            metadata.fullName ?? "",
            ...metadata.aliases,
            metadata.summary,
          ].some((value) =>
            value.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
          ),
        )
      : items;

    return [...filteredItems].sort((left, right) =>
      left.metadata.term.localeCompare(right.metadata.term, "ko-KR", {
        sensitivity: "base",
      }),
    );
  }, [items, normalizedQuery]);

  const indexTargets = useMemo(() => {
    const firstTermByInitial = new Map<string, string>();
    for (const { metadata } of visibleItems) {
      const initial = getIndexInitial(metadata.term);
      if (initial && !firstTermByInitial.has(initial)) {
        firstTermByInitial.set(initial, metadata.id);
      }
    }

    return INDEX_ORDER.flatMap((initial) => {
      const id = firstTermByInitial.get(initial);
      return id ? [{ initial, id }] : [];
    });
  }, [visibleItems]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="아직 등록된 용어가 없습니다"
        description="용어가 동기화되면 정의와 등장 문맥을 이곳에서 찾아볼 수 있습니다."
      />
    );
  }

  return (
    <div>
      <div className="relative">
        <label htmlFor="glossary-search" className="sr-only">
          용어 검색
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-muted)]"
        />
        <input
          id="glossary-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="용어, 전체 이름, 별칭, 요약 검색"
          autoComplete="off"
          className="h-12 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] pl-11 pr-12 text-[15px] text-[var(--color-fg-primary)] shadow-[var(--shadow-subtle)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-fg-muted)] focus-visible:border-[var(--color-brand-400)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--color-brand-400),transparent_75%)] motion-reduce:transition-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="검색어 지우기"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <p
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]"
      >
        {normalizedQuery
          ? `${visibleItems.length}개의 검색 결과`
          : `전체 ${items.length}개 용어`}
      </p>

      {indexTargets.length > 0 ? (
        <nav
          aria-label="용어 색인"
          className="mt-8 overflow-x-auto rounded-md border border-[var(--color-brand-700)] bg-[var(--color-bg-inverse)] px-3 py-3 text-[var(--color-bg-base)] shadow-[var(--shadow-default)]"
        >
          <div className="flex min-w-max items-center gap-1">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.12em] opacity-60">
              index
            </span>
            {indexTargets.map(({ initial, id }) => (
              <a
                key={initial}
                href={`#${id}`}
                onClick={() => focusTermHeading(id)}
                className="grid size-8 place-items-center rounded font-mono text-[12px] font-semibold transition-colors hover:bg-[var(--color-brand-400)] hover:text-[var(--color-fg-on-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-inverse)] motion-reduce:transition-none"
              >
                {initial}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {visibleItems.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="검색 결과가 없습니다"
            description="다른 용어나 별칭을 입력하거나 검색어를 지워 전체 목록을 확인하세요."
            action={
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-brand-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] motion-reduce:transition-none"
              >
                전체 용어 보기
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-10 divide-y divide-[var(--color-border-subtle)] border-y border-[var(--color-border-subtle)]">
          {visibleItems.map((item) => (
            <GlossaryEntry key={item.metadata.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function GlossaryEntry({ item }: { item: GlossaryIndexItem }) {
  const [mentionsExpanded, setMentionsExpanded] = useState(false);
  const { metadata, description, mentions, references } = item;
  const visibleMentions = mentionsExpanded
    ? mentions
    : mentions.slice(0, INITIAL_MENTION_COUNT);
  const hiddenMentionCount = mentions.length - INITIAL_MENTION_COUNT;
  const marker = getIndexInitial(metadata.term) ?? metadata.term.slice(0, 1);

  return (
    <article className="group grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-9 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5 sm:py-11">
      <div aria-hidden="true" className="pt-1">
        <span className="flex h-8 items-center border-l-2 border-[var(--color-brand-400)] pl-2 font-mono text-[11px] font-semibold text-[var(--color-brand-text)] sm:pl-3">
          {marker}
        </span>
      </div>

      <div className="min-w-0">
        <header>
          <h2
            id={metadata.id}
            tabIndex={-1}
            className="scroll-mt-24 text-balance text-2xl font-semibold tracking-[-0.025em] text-[var(--color-fg-primary)] outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg-base)] sm:text-3xl"
          >
            {metadata.term}
          </h2>
          {metadata.fullName ? (
            <p className="mt-1 font-mono text-xs leading-5 text-[var(--color-fg-muted)]">
              {metadata.fullName}
            </p>
          ) : null}
          {metadata.aliases.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="별칭">
              {metadata.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-fg-secondary)]"
                >
                  {alias}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-5 text-[15px] font-medium leading-7 text-[var(--color-fg-primary)]">
            {metadata.summary}
          </p>
        </header>

        <div className="mt-5 border-l border-[var(--color-border-default)] pl-4 text-[var(--color-fg-secondary)] sm:pl-5 [&_.prose]:text-[15px] [&_.prose]:leading-7 [&_.prose_h2]:text-xl [&_.prose_h2]:before:hidden">
          {description}
        </div>

        {references.length > 0 ? (
          <section className="mt-7" aria-labelledby={`${metadata.id}-references`}>
            <h3
              id={`${metadata.id}-references`}
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fg-muted)]"
            >
              참고 자료
            </h3>
            <ul className="mt-2 space-y-1.5">
              {references.map((reference) => (
                <li key={reference.url}>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-brand-text)] underline decoration-[var(--color-border-strong)] underline-offset-4 transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] motion-reduce:transition-none"
                  >
                    {reference.label}
                    <span className="sr-only"> (새 창에서 열림)</span>
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {mentions.length > 0 ? (
          <section className="mt-8" aria-labelledby={`${metadata.id}-mentions`}>
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-2">
              <h3
                id={`${metadata.id}-mentions`}
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fg-muted)]"
              >
                언급된 페이지
              </h3>
              <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">
                {mentions.length} entries
              </span>
            </div>
            <ul className="mt-1 divide-y divide-[var(--color-border-subtle)]">
              {visibleMentions.map((mention, index) => (
                <li key={`${mention.pageType}:${mention.url}:${index}`}>
                  <Link
                    href={mention.url}
                    className="group/mention flex flex-col gap-1 rounded-sm py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="w-fit shrink-0 rounded border border-[var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--color-fg-muted)]">
                      {mention.pageType === "post" ? "post" : "category"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--color-fg-secondary)] transition-colors group-hover/mention:text-[var(--color-brand-text)] motion-reduce:transition-none">
                      {mention.pageTitle}
                    </span>
                    {mention.updatedAtLabel ? (
                      <time className="shrink-0 font-mono text-[10px] text-[var(--color-fg-faint)]">
                        {mention.updatedAtLabel}
                      </time>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenMentionCount > 0 ? (
              <button
                type="button"
                onClick={() => setMentionsExpanded((expanded) => !expanded)}
                aria-expanded={mentionsExpanded}
                className="mt-3 rounded-sm font-mono text-[11px] font-medium text-[var(--color-brand-text)] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] motion-reduce:transition-none"
              >
                {mentionsExpanded
                  ? "최근 5개만 보기"
                  : `${hiddenMentionCount}개 더 보기`}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-12 text-center">
      <p className="text-base font-semibold text-[var(--color-fg-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-6 text-[var(--color-fg-secondary)]">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function getIndexInitial(term: string): string | null {
  const firstCharacter = term.trim().charAt(0);
  if (!firstCharacter) return null;

  const code = firstCharacter.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return KOREAN_INITIALS[Math.floor((code - 0xac00) / 588)] ?? null;
  }

  const latinInitial = firstCharacter.toLocaleUpperCase("en-US");
  return /^[A-Z]$/.test(latinInitial) ? latinInitial : null;
}

function focusTermHeading(id: string) {
  document.getElementById(id)?.focus({ preventScroll: true });
}
