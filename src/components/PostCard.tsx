import Link from "next/link";
import type { CSSProperties } from "react";
import { getCategoryIcon } from "@/infra/db/constants";
import type { PostData } from "@/infra/db/types";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-meta";
import { formatDate } from "@/lib/date-utils";
import { Eye } from "lucide-react";
import { PostThumbnail } from "./PostThumbnail";

interface PostCardProps {
  post: PostData;
  /** "row" (기본 목록) | "grid" (격자 카드) | "featured" (대표 카드) */
  variant?: "row" | "grid" | "featured";
  showCategory?: boolean;
  viewCount?: number;
}

function postHref(slug: string): string {
  return `/posts/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

export function PostCard({
  post,
  variant = "row",
  showCategory = true,
  viewCount,
}: PostCardProps) {
  const cats = post.categories?.length ? post.categories : [post.category];
  const catColor = getCategoryColor(post.category);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;
  const href = postHref(post.slug);

  if (variant === "featured") {
    return (
      <Link
        href={href}
        style={inlineStyle}
        className="group relative block aspect-video overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-[var(--duration-default)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <PostThumbnail
          thumbnailUrl={post.thumbnailUrl}
          category={post.category}
          sizes="(min-width: 1024px) 1120px, 100vw"
          className="absolute inset-0 h-full w-full"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.68)_42%,rgba(0,0,0,0.08)_78%)]"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 text-white sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white/85">
            {showCategory &&
              cats.map((cat) => (
                <span key={cat} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                  <span>{getCategoryLabel(cat)}</span>
                </span>
              ))}
            <span>{formatDate(post.createdAt)}</span>
            {viewCount !== undefined && (
              <span className="inline-flex items-center gap-1 text-white/75">
                <Eye className="h-3 w-3" aria-hidden />
                {viewCount.toLocaleString()}
              </span>
            )}
          </div>
          <h3 className="line-clamp-3 max-w-4xl text-balance text-2xl font-semibold leading-tight tracking-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl">
            {post.title}
          </h3>
        </div>
      </Link>
    );
  }

  if (variant === "grid") {
    return (
      <Link
        href={href}
        style={inlineStyle}
        className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-[var(--duration-default)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <PostThumbnail
          thumbnailUrl={post.thumbnailUrl}
          category={post.category}
          sizes="(min-width: 1024px) 360px, 100vw"
          className="aspect-video w-full border-b border-[var(--color-border-subtle)]"
        />
        <div className="flex flex-1 flex-col gap-2 p-5">
          {showCategory && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]">
              {cats.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1"
                  style={{ color: getCategoryColor(cat) }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                  <span>{getCategoryLabel(cat)}</span>
                </span>
              ))}
            </div>
          )}
          <h3 className="line-clamp-2 text-[17px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)]">
            {post.title}
          </h3>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3 font-mono text-[11px] text-[var(--color-fg-muted)]">
            <span>{formatDate(post.createdAt)}</span>
            {viewCount !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // variant === "row" (기본, Editorial row list)
  // @container 는 후손에게만 query scope 를 제공하므로 별도 래퍼에 부여한다
  return (
    <div className="@container last:border-b last:border-[var(--color-border-subtle)]">
      <Link
        href={href}
        style={inlineStyle}
        className="group relative grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 border-t border-[var(--color-border-subtle)] py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] @lg:grid-cols-[160px_minmax(0,1fr)_180px_100px] @lg:gap-6 @lg:py-6"
      >
        <PostThumbnail
          thumbnailUrl={post.thumbnailUrl}
          category={post.category}
          sizes="(min-width: 1024px) 160px, 112px"
          className="aspect-video w-full rounded-md border border-[var(--color-border-subtle)]"
        />
        <div className="min-w-0">
          <h3 className="text-[16px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] transition-colors duration-150 group-hover:text-[var(--color-brand-400)] motion-reduce:transition-none @lg:text-[17px]">
            {post.title}
          </h3>
          {post.description && (
            <div className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)] @lg:text-[14px]">
              {post.description}
            </div>
          )}
          {/* 모바일에선 cat/meta 를 본문 아래로 내림 */}
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-[var(--color-fg-muted)] @lg:hidden">
            {showCategory && cats.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 uppercase tracking-[0.04em]"
                style={{ color: getCategoryColor(cat) }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {getCategoryIcon(cat)} {getCategoryLabel(cat)}
              </span>
            ))}
            {viewCount !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {showCategory && (
          <div className="hidden self-center flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] @lg:flex">
            {cats.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5"
                style={{ color: getCategoryColor(cat) }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                <span>{getCategoryLabel(cat)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="hidden self-center text-right font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] @lg:block">
          {formatDate(post.createdAt)}
          {viewCount !== undefined && (
            <>
              <br />
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewCount.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </Link>
    </div>
  );
}
