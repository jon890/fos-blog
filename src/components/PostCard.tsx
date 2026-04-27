import Link from "next/link";
import type { CSSProperties } from "react";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import type { PostData } from "@/infra/db/types";
import { getCategoryColor, toCanonicalCategory } from "@/lib/category-meta";
import { Eye } from "lucide-react";

interface PostCardProps {
  post: PostData;
  /** "row" (기본, Editorial) | "grid" (Card grid) */
  variant?: "row" | "grid";
  showCategory?: boolean;
  viewCount?: number;
  /** row variant 에서 좌측에 표시되는 정렬 번호 (없으면 미표시) */
  index?: number;
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || DEFAULT_CATEGORY_ICON;
}

function postHref(slug: string): string {
  return `/posts/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

export function PostCard({
  post,
  variant = "row",
  showCategory = true,
  viewCount,
  index,
}: PostCardProps) {
  const catColor = getCategoryColor(post.category);
  const canonical = toCanonicalCategory(post.category);
  const inlineStyle = { "--cat-color": catColor } as CSSProperties;

  if (variant === "grid") {
    return (
      <Link
        href={postHref(post.slug)}
        style={inlineStyle}
        className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]"
      >
        <div className="flex flex-1 flex-col gap-2 p-5">
          {showCategory && (
            <div
              className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{ color: "var(--cat-color)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              <span>{canonical}</span>
            </div>
          )}
          <h3 className="text-[17px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] line-clamp-2">
            {post.title}
          </h3>
          {post.description && (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
              {post.description}
            </p>
          )}
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
  const num = typeof index === "number" ? String(index + 1).padStart(3, "0") : null;

  return (
    <Link
      href={postHref(post.slug)}
      style={inlineStyle}
      className="group relative grid grid-cols-[64px_1fr_auto] items-baseline gap-4 border-t border-[var(--color-border-subtle)] py-5 last:border-b md:grid-cols-[80px_1fr_180px_100px] md:gap-6 md:py-6"
    >
      <span className="self-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-faint)]">
        {num ? `— ${num}` : "—"}
      </span>

      <div className="min-w-0">
        <div className="text-[16px] font-medium leading-snug tracking-tight text-[var(--color-fg-primary)] transition-colors duration-150 group-hover:text-[var(--color-brand-400)] md:text-[17px]">
          {post.title}
        </div>
        {post.description && (
          <div className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[14px]">
            {post.description}
          </div>
        )}
        {/* 모바일에선 cat/meta 를 본문 아래로 내림 */}
        <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--color-fg-muted)] md:hidden">
          {showCategory && (
            <span
              className="inline-flex items-center gap-1.5 uppercase tracking-[0.04em]"
              style={{ color: "var(--cat-color)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {getCategoryIcon(post.category)} {canonical}
            </span>
          )}
          {viewCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewCount.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {showCategory && (
        <div
          className="hidden self-center items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] md:flex"
          style={{ color: "var(--cat-color)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          <span>{canonical}</span>
        </div>
      )}

      <div className="hidden self-center text-right font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)] md:block">
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
  );
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
