import { HeroMesh } from "./HeroMesh";

interface HomeHeroProps {
  postCount: number;
  categoryCount: number;
  /** 시리즈 수 — issue #72 미구현이면 null. null 이면 stat 항목 자리에 "—" placeholder */
  seriesCount: number | null;
  /** 뉴스레터 구독자 수 — Newsletter 미구현이면 null. null 이면 "—" placeholder */
  subscriberCount: number | null;
}

function formatStatValue(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return n.toLocaleString();
}

export function HomeHero({ postCount, categoryCount, seriesCount, subscriberCount }: HomeHeroProps) {
  return (
    <header className="hero relative overflow-hidden border-b border-[var(--color-border-subtle)] px-6 pt-20 pb-16 md:pt-28 md:pb-24">
      <HeroMesh primaryHue={195} />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 80%, transparent)",
        }}
      />

      <div className="container relative z-[2] mx-auto max-w-[1180px]">
        {/* eyebrow + 1px brand line prefix (mockup .h-hero .eyebrow::before) */}
        <div className="hero-eyebrow inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
          <span aria-hidden className="block h-px w-6 bg-[var(--color-brand-400)]" />
          <span>FOS-WORLD · DEV NOTES · 2026</span>
        </div>

        <h1 className="mt-5 max-w-[22ch] text-[36px] font-semibold leading-[1.05] tracking-tight text-[var(--color-fg-primary)] md:text-[64px]">
          한국어 개발자를 위한
          <br />
          학습 노트
          <em className="not-italic font-mono text-[var(--color-cat-react)]">
            (.mdx)
          </em>
          <span className="hero-caret" aria-hidden />
        </h1>

        <p className="mt-6 max-w-[60ch] text-[16px] leading-relaxed text-[var(--color-fg-secondary)] md:text-[18px]">
          AI · 알고리즘 · DB · DevOps · Java/Spring · JS/TS · React · Next.js · System.
          공부하면서 기록하고, 기록하면서 다시 배웁니다.
        </p>

        <dl className="hero-meta mt-10 grid grid-cols-2 gap-x-8 gap-y-4 font-mono text-[12px] md:grid-cols-4">
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">posts</dt>
            <dd className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-fg-primary)]">{postCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">categories</dt>
            <dd className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-fg-primary)]">{categoryCount}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">series</dt>
            <dd className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-fg-primary)]">{formatStatValue(seriesCount)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">subscribers</dt>
            <dd className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-fg-primary)]">{formatStatValue(subscriberCount)}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
