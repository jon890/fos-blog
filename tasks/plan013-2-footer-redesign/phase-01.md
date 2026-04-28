# Phase 01 — SiteFooter 4-column + Categories + Connect (RSS/Newsletter graceful) + eyebrow status + bottom stack

## 컨텍스트 (자기완결 프롬프트)

plan009 (design tokens) + plan013 (Header + Hero) 머지 완료 전제. Claude Design Round 3 의 `footer.jsx` (196줄) + `footer.css` (334줄) 기반으로 fos-blog 의 Footer 를 리디자인. 현재 `src/app/layout.tsx` 의 인라인 `<footer>` (4-column: Brand/Links/Social/Policy) 를 **`src/components/SiteFooter.tsx`** 신규 컴포넌트로 분리하면서 mockup 의 새 구조 (Brand / Site+Policy / **Categories** / **Connect** with RSS/Newsletter) + eyebrow status row + mesh accent + 'built with' stack 까지 적용.

scope 외 (별도 plan/issue):
- RSS feed 실제 구현 (`/rss.xml` 라우트) → **별도 issue** (Footer 의 링크는 graceful — 라우트 없으면 placeholder)
- Newsletter 가입 기능 (실제 구독 폼/Mailchimp/Buttondown 등) → **별도 issue**
- Series / Tags 링크 (`/series`, `/tags`) → issue #72 의 series 작업과 함께 라우트 신설
- Categories 9개 링크의 정확한 URL — 현재 fos-blog 카테고리 페이지가 raw key (`/category/AI`, `/category/database` 등) 를 사용. **plan010 의 `category-meta` 헬퍼로 canonical → raw 역매핑 또는 canonical URL `/category/canonical/db` 추가** (이번 phase 결정)

### 현재 baseline (변경 대상)

`src/app/layout.tsx` 라인 144-240:
- `<footer className="border-t border-gray-200 dark:border-gray-800 py-12 mt-16">` 인라인
- 4-column grid (Brand / 바로가기 / 소셜 / 정책)
- `<VisitorCount />` + copyright
- 모든 색 하드코딩 (gray/blue Tailwind 클래스)
- **이번 phase 에서 모두 제거 + `<SiteFooter />` 컴포넌트 호출로 교체**

`src/components/VisitorCount.tsx`:
- 기존 누적 방문자 수 컴포넌트 (확인 후 재사용)

`src/lib/category-meta.ts` (plan010):
- `toCanonicalCategory()` / `getCategoryHue()` / `getCategoryColor()` — Footer 의 Categories col 에서 9 canonical 표시에 사용

`src/app/globals.css` (plan013 후):
- `--color-bg-base/subtle/elevated`, `--color-fg-primary/secondary/muted/faint`, `--color-border-subtle/default`, `--color-brand-400`, `--color-cat-*` (9), `--mesh-stop-*` (6), `--font-mono/sans`, `--shadow-*` 모두 정의

### 이 phase 의 핵심 전환

1. **컴포넌트 분리**: layout.tsx 인라인 → `src/components/SiteFooter.tsx` 신규. layout 가독성 + 재사용성 확보
2. **4-column 구조**: Brand / **Site (idx 01) + Policy (idx 02)** / **Categories (idx 03)** / **Connect (idx 04)** (mockup 정확)
3. **Eyebrow row**: 좌측 `FOS-BLOG · FOOTER` (brand 1px line prefix) + 우측 `● all systems normal · v0.1 · {date} · seoul, kr` (status pulse — 정적 표시, 서버 헬스체크 없음)
4. **Categories 9 canonical**: `getCategoryColor()` 로 cat-color dot + label + arrow `↗`. URL 결정 — **canonical key 를 그대로 path 로** (`/category/canonical/ai`, `/category/canonical/db` 등) 또는 **기존 raw key 첫 매핑** (`/category/AI`, `/category/database` 등). 권장: **별도 페이지 신설 없이 `/categories` 에 9 canonical filter — 단순 anchor `#ai`** (이번 phase 의 graceful fallback. 추후 plan014 에서 정식 페이지 분리)
5. **Connect (4 항목)**: GitHub (`@jon890`), Source repository (`jon890/fos-study`), **RSS feed (`/rss.xml`, 미구현 시 graceful — 링크 비활성)**, **Newsletter (미구현 시 graceful — placeholder, 클릭 시 alert 금지 → tooltip "준비 중" 또는 비활성)**
6. **Visitor counter**: 기존 `<VisitorCount />` 그대로 사용. Footer mockup 의 `.fbf-counter` 톤으로 wrap
7. **Mesh accent + grid line**: top accent line (`.fbf-accent`) + 약한 mesh (`.fbf-mesh` opacity 0.3) + grid line (`.fbf-grid`) — Hero 와 동일 톤이지만 약하게
8. **Bottom row**: copy `© {year} FOS Study. All posts MIT-licensed.` + stack `built with · Next.js · Tailwind v4 · Geist · Pretendard · oklch`
9. **모바일**: 4-column → 1-column stack (mockup `.fbf-shell.mobile .fbf-grid4 grid-template-columns: 1fr`)

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-017** (디자인 시스템)
- `docs/design-inspiration.md` — Round 3 mockup 메모
- `/tmp/round3-footer.jsx` (Round 3 추출) — 196줄, source of truth for JSX 구조
- `/tmp/round3-footer.css` (Round 3 추출) — 334줄, source of truth for 스타일
- `src/app/layout.tsx` 라인 144-240 — 현재 인라인 footer
- `src/components/VisitorCount.tsx` — 재사용 대상
- `src/lib/category-meta.ts` (plan010) — Categories col 의 canonical 9
- `.claude/skills/_shared/common-critic-patterns.md` — 시드 7 패턴

## 사전 게이트

```bash
# cwd: <worktree root>

# 1) plan009 + plan013 머지 완료 확인
grep -n -- "--mesh-stop-01" src/app/globals.css
grep -n "HomeHero" src/components/HomeHero.tsx
grep -n "fos-blog<span" src/components/Header.tsx     # plan013 의 Header brand wordmark 존재 확인 (slug suffix 는 어떤 값이든 통과)
grep -n "FOS-WORLD · DEV NOTES" src/components/HomeHero.tsx

# 2) 재사용 대상 확인
test -f src/components/VisitorCount.tsx
grep -n "export function VisitorCount\|export default" src/components/VisitorCount.tsx
test -f src/lib/category-meta.ts
grep -n "getCategoryColor\|getCategoryHue" src/lib/category-meta.ts

# 3) Round 3 mockup 추출
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777284451046-7o5vc3.bin 'fos-blog/project/footer.jsx' > /tmp/round3-footer.jsx
tar xzOf ~/.claude/projects/-Users-nhn-personal-fos-blog/d11b8756-7896-451b-932e-0678c2241d67/tool-results/webfetch-1777284451046-7o5vc3.bin 'fos-blog/project/footer.css' > /tmp/round3-footer.css
test -s /tmp/round3-footer.jsx
test -s /tmp/round3-footer.css

# 4) layout.tsx 의 현재 footer 위치
grep -n "<footer" src/app/layout.tsx
```

## 작업 목록 (총 5개)

### 1. `src/lib/category-meta.ts` — canonical self-map 보강

현재 `RAW_TO_CANONICAL` 은 `"AI"`, `"database"`, `"javascript"` 등 raw 키만 매핑. SiteFooter 가 canonical 키 (`"ai"`, `"db"`, `"js"`, `"algorithm"`, `"devops"`, `"java"`, `"react"`, `"next"`, `"system"`) 를 직접 넘기면 `toCanonicalCategory("ai")` 가 `undefined → "system"` 으로 fallback → 3개 카테고리(ai/db/js) 의 hue 가 system(250) 으로 잘못 렌더링.

`RAW_TO_CANONICAL` 에 canonical → canonical self-map 9 항목 추가:

```ts
const RAW_TO_CANONICAL: Record<string, CanonicalCategory> = {
  // raw → canonical (기존)
  AI: "ai",
  algorithm: "algorithm",
  database: "db",
  redis: "db",
  devops: "devops",
  java: "java",
  javascript: "js",
  html: "js",
  css: "js",
  react: "react",
  next: "next",
  // canonical → canonical self-map (Footer / 직접 호출 안전망)
  ai: "ai",
  db: "db",
  js: "js",
  // algorithm/devops/java/react/next 는 raw 값과 canonical 값이 동일하므로 위 라인이 그대로 self-map 역할
  system: "system",
};
```

설계 메모:
- canonical key 도 `RAW_TO_CANONICAL` 의 key 로 추가하면 "raw 가 canonical 일 때도 통과" 가 자연스러워진다 (멱등). 호출자가 "이 값이 raw 인가 canonical 인가" 신경 쓸 필요 없음
- `algorithm`/`devops`/`java`/`react`/`next` 는 이미 self-map 효과 (raw 키와 canonical 값이 우연히 동일)
- `getCategoryColor` / `getCategoryHue` / `getCategoryTokenVar` 모두 자동으로 영향 받아 정합

### 2. `src/components/SiteFooter.tsx` 신규 (server)

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import { Github, Code2, Rss, Mail } from "lucide-react";
import { VisitorCount } from "./VisitorCount";
import { getCategoryColor } from "@/lib/category-meta";

const FOOTER_CATEGORIES = [
  { id: "ai",        label: "AI" },
  { id: "algorithm", label: "Algorithm" },
  { id: "db",        label: "DB" },
  { id: "devops",    label: "DevOps" },
  { id: "java",      label: "Java/Spring" },
  { id: "js",        label: "JS/TS" },
  { id: "react",     label: "React" },
  { id: "next",      label: "Next.js" },
  { id: "system",    label: "System" },
] as const;

const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/posts/latest", label: "Posts" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
];

const POLICY_LINKS = [
  { href: "/about", label: "소개", path: "/about" },
  { href: "/privacy", label: "개인정보처리방침", path: "/privacy" },
  { href: "/contact", label: "연락처", path: "/contact" },
];

const BUILD_DATE = "2026.04.27";  // build time stamp — package 또는 env 로 동적화 가능 (별도 issue)

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="fbf relative overflow-hidden border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
      {/* Top accent line */}
      <div aria-hidden className="fbf-accent absolute top-0 left-0 right-0 h-px" />

      {/* Mesh accent (subtle) */}
      <div
        aria-hidden
        className="fbf-mesh pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(40% 80% at 10% 0%, oklch(0.7 0.16 230 / 0.45), transparent 60%), radial-gradient(40% 70% at 90% 0%, oklch(0.65 0.18 280 / 0.32), transparent 60%), radial-gradient(35% 60% at 50% 100%, oklch(0.78 0.13 195 / 0.40), transparent 60%)",
          filter: "blur(40px) saturate(140%)",
        }}
      />
      {/* Grid lines */}
      <div
        aria-hidden
        className="fbf-grid pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 90%)",
        }}
      />

      <div className="relative z-[2] mx-auto max-w-[1280px] px-6 pt-16 pb-7 md:px-8">
        {/* Eyebrow */}
        <div className="fbf-eyebrow flex flex-col gap-3 border-b border-[var(--color-border-subtle)] pb-7 mb-10 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-2.5 text-[var(--color-brand-400)]">
            <span aria-hidden className="block h-px w-6 bg-[var(--color-brand-400)]" />
            FOS-BLOG · FOOTER
          </span>
          <span className="inline-flex flex-wrap items-center gap-3.5 text-[var(--color-fg-faint)]">
            <span className="inline-flex items-center gap-2 text-[var(--color-fg-secondary)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-success)]"
                style={{ boxShadow: "0 0 6px var(--color-success)" }}
              />
              all systems normal
            </span>
            <span className="hidden md:inline opacity-50">·</span>
            <span className="hidden md:inline">v0.1 · {BUILD_DATE}</span>
            <span className="hidden md:inline opacity-50">·</span>
            <span className="hidden md:inline">seoul, kr</span>
          </span>
        </div>

        {/* 4-column grid (모바일 1-col stack) */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:gap-8">
          {/* Brand col */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] font-mono text-[14px] font-semibold text-[var(--color-brand-400)]"
                style={{ boxShadow: "inset 0 1px 0 0 rgb(255 255 255 / 0.04)" }}
              >
                F
              </span>
              <span className="font-mono text-[14px] tracking-tight text-[var(--color-fg-primary)]">
                fos-blog<span className="text-[var(--color-fg-muted)]">/study</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[36ch] text-[13px] leading-relaxed text-[var(--color-fg-secondary)]">
              개발 학습 기록을 정리하는 블로그입니다. 공부하면서 기록하고, 기록하면서 다시 배웁니다.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-[11px]">
              <span className="text-[var(--color-fg-muted)] uppercase tracking-[0.06em]">visitors</span>
              <span className="text-[var(--color-brand-400)] tabular-nums">
                <VisitorCount />
              </span>
            </div>
          </div>

          {/* Site + Policy col */}
          <div>
            <ColHead idx="01" label="site" />
            <FooterList
              items={SITE_LINKS.map((l) => ({ href: l.href, label: l.label, arrow: "↗" }))}
            />
            <div className="mt-8" />
            <ColHead idx="02" label="policy" />
            <FooterList
              items={POLICY_LINKS.map((l) => ({ href: l.href, label: l.label, arrow: l.path, arrowMono: true }))}
            />
          </div>

          {/* Categories col */}
          <div>
            <ColHead idx="03" label="categories" />
            <ul className="space-y-2">
              {FOOTER_CATEGORIES.map((c) => {
                const color = getCategoryColor(c.id);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/categories#${c.id}`}
                      style={{ "--cat-color": color } as CSSProperties}
                      className="group flex items-center gap-2.5 text-[13px] text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)]"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--cat-color)" }}
                      />
                      <span>{c.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-[var(--color-fg-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--color-brand-400)]">
                        ↗
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Connect col */}
          <div>
            <ColHead idx="04" label="connect" />
            <ul className="space-y-3">
              <SocialItem
                href="https://github.com/jon890"
                external
                Icon={Github}
                ttl="GitHub"
                sub="@jon890"
                arrow="↗"
              />
              <SocialItem
                href="https://github.com/jon890/fos-study"
                external
                Icon={Code2}
                ttl="Source repository"
                sub="jon890/fos-study"
                arrow="↗"
              />
              <SocialItem
                href="/rss.xml"
                Icon={Rss}
                ttl="RSS feed"
                sub="/rss.xml"
                arrow="↗"
                disabled  // 미구현 — 별도 issue. graceful fallback.
              />
              <SocialItem
                href="#newsletter"
                Icon={Mail}
                ttl="Newsletter"
                sub="매주 1 회 · 한 편의 글"
                arrow="→"
                disabled  // 미구현 — 별도 issue.
              />
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-7 font-mono text-[11px] text-[var(--color-fg-muted)] md:flex-row md:items-center md:justify-between">
          <div className="copy">
            © {year} <strong className="font-semibold text-[var(--color-fg-primary)]">FOS Study</strong>. All posts MIT-licensed.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>built with</span>
            {["Next.js", "Tailwind v4", "Geist", "Pretendard", "oklch"].map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className="opacity-50">·</span>
                <span>{s}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function ColHead({ idx, label }: { idx: string; label: string }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
      <span className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[var(--color-fg-faint)]">
        {idx}
      </span>
      <span>{label}</span>
    </div>
  );
}

interface FooterItem {
  href: string;
  label: string;
  arrow: string;
  arrowMono?: boolean;
}
function FooterList({ items }: { items: FooterItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={`${it.href}-${it.label}`}>
          <Link
            href={it.href}
            className="group flex items-center justify-between gap-3 text-[13px] text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)]"
          >
            <span>{it.label}</span>
            <span
              className={`text-[var(--color-fg-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--color-brand-400)] ${it.arrowMono ? "font-mono text-[10px]" : ""}`}
            >
              {it.arrow}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface SocialItemProps {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  ttl: string;
  sub: string;
  arrow: string;
  external?: boolean;
  disabled?: boolean;
}
function SocialItem({ href, Icon, ttl, sub, arrow, external, disabled }: SocialItemProps) {
  const className =
    "group flex items-center gap-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2.5 transition-colors hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-overlay)]" +
    (disabled ? " pointer-events-none opacity-40" : "");
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)] group-hover:text-[var(--color-brand-400)]" />
      <span className="flex flex-1 flex-col">
        <span className="text-[13px] text-[var(--color-fg-primary)]">{ttl}</span>
        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{sub}</span>
      </span>
      <span className="font-mono text-[12px] text-[var(--color-fg-faint)] group-hover:text-[var(--color-brand-400)]">
        {arrow}
      </span>
    </>
  );

  return (
    <li>
      {disabled ? (
        <span className={className} aria-disabled="true" title="준비 중">
          {inner}
        </span>
      ) : external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={className}>
          {inner}
        </Link>
      )}
    </li>
  );
}
```

설계 메모:
- **server component** — interactivity 0. VisitorCount 만 자체 client (기존 컴포넌트)
- 각 sub-component (`ColHead`, `FooterList`, `SocialItem`) 는 같은 파일 안에 private — 재사용 범위 footer 한정
- `disabled` prop 으로 RSS / Newsletter graceful fallback (`<a>` 가 아닌 `<span>` + `aria-disabled` + tooltip "준비 중")
- `BUILD_DATE` 는 일단 상수. 동적화는 별도 issue (env 또는 빌드 시 주입)
- `lucide-react` 의 `Github / Code2 / Rss / Mail / ArrowUpRight` 사용 (모두 기존 의존성)
- mesh / grid / accent 모두 inline style — globals.css 룰 추가 없이 자기완결

### 3. `src/app/layout.tsx` — 인라인 footer 제거 + `<SiteFooter />` 호출

```tsx
import { SiteFooter } from "@/components/SiteFooter";
// VisitorCount import 는 SiteFooter 가 흡수 — layout.tsx 에서 제거

// JSX:
<main>{children}</main>
<SiteFooter />
```

기존 라인 144-240 의 인라인 `<footer>` 전체 삭제. `<SiteFooter />` 한 줄로 교체. `<VisitorCount />` 도 footer 안으로 이동 (layout.tsx 에서 import 제거).

### 4. `src/app/globals.css` — `.fbf-accent` 그라디언트 룰 (선택)

mockup 의 `.fbf-accent` 는 horizontal gradient line:
```css
.fbf-accent {
  background: linear-gradient(
    to right,
    transparent,
    color-mix(in oklch, var(--color-brand-400), transparent 60%) 30%,
    var(--color-brand-400) 50%,
    color-mix(in oklch, var(--color-brand-400), transparent 60%) 70%,
    transparent
  );
}
```

inline style 로 처리하기 어색해 globals.css 에 추가 (한 룰만).

### 5. 통합 검증 + `index.json` completed 마킹

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test -- --run
pnpm build

# layout.tsx 인라인 footer 제거 확인
! grep -nE "<footer className.*border-t border-gray" src/app/layout.tsx
grep -n "<SiteFooter />" src/app/layout.tsx

# SiteFooter 가 9 카테고리 모두 렌더
grep -nE 'id:\s*"(ai|algorithm|db|devops|java|js|react|next|system)"' src/components/SiteFooter.tsx | wc -l  # = 9

# graceful fallback (RSS / Newsletter)
grep -n "disabled" src/components/SiteFooter.tsx | head -3
grep -n "RSS feed" src/components/SiteFooter.tsx
grep -n "Newsletter" src/components/SiteFooter.tsx

# 빌드 산출물
grep -rE "fbf-accent|FOS-BLOG · FOOTER" .next/server/app/ 2>/dev/null | head -3
```

수동 smoke (선택, 사용자 PR 리뷰 시):
- `pnpm dev` → 모든 페이지 footer 확인 (홈/카테고리/글 상세/about/privacy)
- 다크/라이트 토글 → mesh + grid + 색 토큰 자연 전환
- 모바일 (Chrome DevTools 360px) → 4-column → 1-column stack
- RSS / Newsletter 클릭 시 비활성 (pointer-events-none) + tooltip "준비 중"
- VisitorCount 가 Brand col 의 counter 안에 정상 표시
- Categories 9개 hover 시 cat-color dot + arrow 노출

마지막으로 `tasks/plan013-2-footer-redesign/index.json` 의 `status` 와 `phases[0].status` 를 `"completed"` 로 업데이트:

```bash
# cwd: <worktree root>
jq '.status = "completed" | .phases[0].status = "completed"' tasks/plan013-2-footer-redesign/index.json > tasks/plan013-2-footer-redesign/index.json.tmp \
  && mv tasks/plan013-2-footer-redesign/index.json.tmp tasks/plan013-2-footer-redesign/index.json
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) SiteFooter 신규 + layout.tsx 통합
test -f src/components/SiteFooter.tsx
grep -n "export function SiteFooter" src/components/SiteFooter.tsx
grep -n "<SiteFooter />" src/app/layout.tsx
! grep -nE "<footer\s+className=\"border-t border-gray-200" src/app/layout.tsx

# 2) 4-column + Categories + Connect
grep -nE 'id:\s*"(ai|algorithm|db|devops|java|js|react|next|system)"' src/components/SiteFooter.tsx | wc -l  # = 9
grep -n "ColHead" src/components/SiteFooter.tsx
grep -n "SocialItem" src/components/SiteFooter.tsx

# 3) Eyebrow + status pulse + bottom stack
grep -n "FOS-BLOG · FOOTER" src/components/SiteFooter.tsx
grep -n "all systems normal" src/components/SiteFooter.tsx
grep -n "MIT-licensed" src/components/SiteFooter.tsx
grep -n "built with" src/components/SiteFooter.tsx
grep -nE "Next\.js.*Tailwind v4.*Geist.*Pretendard.*oklch" src/components/SiteFooter.tsx | head -1 || \
  grep -c '"\(Next\.js\|Tailwind v4\|Geist\|Pretendard\|oklch\)"' src/components/SiteFooter.tsx  # >= 5

# 4) graceful fallback
grep -n "RSS feed" src/components/SiteFooter.tsx
grep -n "Newsletter" src/components/SiteFooter.tsx
grep -nE "disabled.*=.*\{?true\}?" src/components/SiteFooter.tsx | head -2

# 5) plan010 category-meta 사용
grep -n "from \"@/lib/category-meta\"" src/components/SiteFooter.tsx
grep -n "getCategoryColor" src/components/SiteFooter.tsx

# 6) VisitorCount 재사용
grep -n "from \"./VisitorCount\"" src/components/SiteFooter.tsx
! grep -n "import.*VisitorCount" src/app/layout.tsx

# 7) 토큰만 사용 (하드코딩 색 금지)
! grep -nE "bg-gray-200|dark:bg-gray-950|text-gray-600|dark:text-gray-400|hover:text-blue-600" src/components/SiteFooter.tsx

# 8) globals.css .fbf-accent 룰
grep -n "\.fbf-accent" src/app/globals.css

# 9) 빌드 + lint + type + test
pnpm test -- --run
pnpm lint
pnpm type-check
pnpm build

# 10) 금지사항
! grep -nE "as any" src/components/SiteFooter.tsx
! grep -nE "console\.(log|warn|error)" src/components/SiteFooter.tsx
! grep -nE "alert\(|confirm\(|prompt\(" src/components/SiteFooter.tsx

# 11) category-meta canonical self-map
grep -nE '^\s+ai:\s*"ai"' src/lib/category-meta.ts
grep -nE '^\s+db:\s*"db"' src/lib/category-meta.ts
grep -nE '^\s+js:\s*"js"' src/lib/category-meta.ts
grep -nE '^\s+system:\s*"system"' src/lib/category-meta.ts

# 12) index.json completed 마킹
[ "$(jq -r .status tasks/plan013-2-footer-redesign/index.json)" = "completed" ]
[ "$(jq -r '.phases[0].status' tasks/plan013-2-footer-redesign/index.json)" = "completed" ]
```

## PHASE_BLOCKED 조건

- plan009 또는 plan013 미머지 (사전 게이트 1 실패) → **PHASE_BLOCKED: 선행 plan 필요**
- `VisitorCount` 컴포넌트 미존재 또는 import 시그니처 변경 → **PHASE_BLOCKED: VisitorCount 위치 확인 후 import 보정**
- `category-meta.ts` 의 `getCategoryColor` 미존재 → **PHASE_BLOCKED: plan010 미머지**
- `/categories` 페이지 의 anchor `#ai/#db/...` 가 실제 동작 안 함 (링크가 가지만 anchor 가 페이지에 없음) → **PHASE_BLOCKED: graceful — 일단 anchor URL 유지, /categories 페이지 측 anchor 추가는 후속 plan**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `fix(category-meta): add canonical self-map for direct canonical-key lookups`
- `feat(footer): add SiteFooter component (4-col + categories + connect)`
- `feat(footer): integrate eyebrow status row + mesh accent + bottom stack`
- `refactor(layout): replace inline footer with <SiteFooter />`
- `feat(globals): add .fbf-accent gradient line rule`
- `chore(tasks): mark plan013-2 completed`

team-lead 가 PR 생성 시 RSS / Newsletter graceful fallback 에 대응하는 issue 2건도 함께 등록 (executor 책임 아님 — phase 본문 외):

```bash
gh issue create \
  --title "RSS feed 라우트 신설 (/rss.xml)" \
  --body "Footer 의 RSS 링크 활성화 위해 /rss.xml 라우트 + RSS 2.0 XML 생성 필요. plan013-2 에서 graceful fallback (disabled) 처리됨. 사용자 결정 필요: 직접 구현 vs feed 생성 라이브러리 (예: feed npm). category/series 필터 적용 여부."

gh issue create \
  --title "Newsletter 구독 기능 도입" \
  --body "Footer 의 Newsletter 링크 활성화 위해 구독 폼 + 백엔드 (Buttondown / Mailchimp / 자체 SMTP) 결정 필요. plan013-2 에서 graceful fallback (disabled) 처리됨. HomeHero 의 subscribers stat 도 Newsletter 구현 후 실값 반영. 무료 플랜 비교 + 운영 비용 고려."
```

## NOTE (critic v1)

- POLICY_LINKS 의 `arrow: l.path` 는 의도된 mockup 디자인 (정책 링크는 hover 시 path 가 표시되는 게 의도). `arrowMono: true` 로 mono font 분리 처리됨. 변경 안 함
- `<span aria-disabled="true">` (RSS/Newsletter disabled) — minor a11y. `role="link"` 추가하면 SR 이 정확히 announce. 단 plain text fallback 으로도 시각/키보드 동작에 차이 없음. 향후 a11y 패스에서 일괄 처리 (별도 plan 또는 follow-up)
- `BUILD_DATE = "2026.04.27"` 하드코딩 — 동적화는 별도 issue 로 위임 (env 또는 빌드시 주입)
