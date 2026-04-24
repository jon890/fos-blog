# Phase 02 — 푸터 링크 + sitemap 반영 + 빌드 검증

## 컨텍스트 (자기완결 프롬프트)

Phase-01 에서 만든 `/privacy`, `/about`, `/contact` 페이지를 사이트 전체에 노출. 푸터(`src/app/layout.tsx`) 에 링크 추가 + `sitemap.ts` 에 반영 → Google 이 새 페이지를 크롤/색인 가능.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-012
- `docs/adsense-checklist.md`
- `src/app/layout.tsx` — 푸터 구조 (line 147-220)
- `src/app/sitemap.ts` — sitemap 생성 로직

## 기존 코드 참조

- `src/app/layout.tsx:160-211` — 푸터의 "바로가기" / "소셜" 섹션
- `src/app/sitemap.ts:15-28` — `staticPages` 배열

## 작업 목록 (총 3개)

### 1. 푸터에 "정책" 섹션 추가

`src/app/layout.tsx` 의 푸터 `grid grid-cols-1 md:grid-cols-3 gap-8` 을 `md:grid-cols-4` 로 확장하고, 기존 3개(Brand / 바로가기 / 소셜) 뒤에 "정책" 섹션 추가:

```tsx
<div>
  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
    정책
  </h3>
  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
    <li>
      <a href="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        소개
      </a>
    </li>
    <li>
      <a href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        개인정보처리방침
      </a>
    </li>
    <li>
      <a href="/contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        연락처
      </a>
    </li>
  </ul>
</div>
```

- grid 를 4열로 확장. 모바일(`grid-cols-1`) 은 유지.
- 기존 내부 `<a href="/">`/`<a href="/categories">` 패턴 그대로 사용 (Next.js `<Link>` 안 써도 existing 패턴 일치 우선)

### 2. `sitemap.ts` 에 정책 페이지 3개 추가

`src/app/sitemap.ts` 의 `staticPages` 배열에 append (기존 2개 뒤에):

```ts
{
  url: `${baseUrl}/about`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.5,
},
{
  url: `${baseUrl}/privacy`,
  lastModified: new Date(),
  changeFrequency: "yearly",
  priority: 0.3,
},
{
  url: `${baseUrl}/contact`,
  lastModified: new Date(),
  changeFrequency: "yearly",
  priority: 0.3,
},
```

- `changeFrequency`: 약관류는 드물게 변경 → `yearly`, about 은 GitHub 프로필 연동이라 `monthly`
- `priority`: 주 콘텐츠(글/카테고리) 보다 낮게

### 3. 통합 검증 + 빌드 산출물에 sitemap 반영 확인

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 빌드된 sitemap 에 새 URL 3개 포함 확인
grep -rE "(privacy|about|contact)" .next/server/app/sitemap.xml* 2>/dev/null | head -5
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 푸터에 정책 섹션 추가
grep -n '"/privacy"' src/app/layout.tsx
grep -n '"/about"' src/app/layout.tsx
grep -n '"/contact"' src/app/layout.tsx
grep -n "개인정보처리방침" src/app/layout.tsx
grep -n "연락처" src/app/layout.tsx

# 2) 푸터 grid 4열 확장
grep -nE "grid-cols-1 md:grid-cols-4" src/app/layout.tsx

# 3) sitemap 에 3개 URL 포함
grep -n "/about" src/app/sitemap.ts
grep -n "/privacy" src/app/sitemap.ts
grep -n "/contact" src/app/sitemap.ts

# 4) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 5) 빌드 산출물에 새 페이지 3개 포함
test -d .next/server/app/privacy
test -d .next/server/app/about
test -d .next/server/app/contact

# 6) 최종 diff 실측
git diff --name-only
git diff --stat
```

## PHASE_BLOCKED 조건

- 푸터 grid 확장이 기존 모바일 레이아웃을 깨뜨림 → **PHASE_BLOCKED: Tailwind 반응형 클래스 조정 필요**
- sitemap 생성 로직에서 새 URL 이 누락됨 (ISR revalidate 이슈) → **PHASE_BLOCKED: sitemap.ts 동작 재검증 필요**

## 완료 후 team-lead 처리

- 통합 검증 재확인 (`pnpm lint && pnpm type-check && pnpm test --run && pnpm build`)
- 커밋 분리 (atomic):
  - `feat(pages): add privacy, about, contact pages (AdSense prerequisites)`
  - `feat(layout): add policy section to footer`
  - `feat(sitemap): include policy pages in sitemap`
- PR 제목: `feat(adsense): add policy/about/contact pages for approval`
- PR 본문에 `docs/adsense-checklist.md` 링크 + 승인 신청 다음 단계 안내
- index.json `status: "completed"` 갱신 + 커밋 + push

## 커밋 제외 (phase 내부)

executor 는 이 phase 내부에서 커밋하지 않는다.
