"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PostThumbnailProps {
  thumbnailUrl?: string | null;
  category: string;
  sizes: string;
  className?: string;
}

export function buildThumbnailSources(
  thumbnailUrl: string | null | undefined,
  category: string,
): string[] {
  const sources = [
    thumbnailUrl?.trim(),
    `/api/og/thumbnails/${encodeURIComponent(category.trim() || "system")}`,
    "/og-default.png",
  ].filter((source): source is string => Boolean(source));

  return Array.from(new Set(sources));
}

export function PostThumbnail({
  thumbnailUrl,
  category,
  sizes,
  className,
}: PostThumbnailProps) {
  const sources = buildThumbnailSources(thumbnailUrl, category);
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-[var(--color-bg-overlay)]",
        className,
      )}
      aria-hidden="true"
    >
      {source ? (
        <Image
          src={source}
          alt=""
          fill
          unoptimized={source.startsWith("/api/og/thumbnails/")}
          sizes={sizes}
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}
