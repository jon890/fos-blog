import { PostCard } from "./PostCard";
import type { PostData } from "@/infra/db/types";

interface Props {
  posts: PostData[];
}

export function RelatedPosts({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1180px] px-4 py-12 md:py-16 border-t border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-3 mb-8">
        <span className="h-px w-6 bg-[var(--color-brand-400)]" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          이런 글도
        </h2>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((p) => (
          <li key={p.path}>
            <PostCard post={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
