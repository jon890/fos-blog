# Phase 02 — 푸터 링크 + sitemap 반영 + 체크리스트 갱신 + 빌드 검증

## 컨텍스트 (자기완결 프롬프트)

Phase-01 에서 만든 `/privacy`, `/about`, `/contact` 페이지를 사이트 전체에 노출. 푸터(`src/app/layout.tsx`) 에 링크 추가 + `sitemap.ts` 에 반영 → Google 이 새 페이지를 크롤/색인 가능. AdSense 신청 선행 체크리스트(`docs/adsense-checklist.md`) 도 구현 완료 상태로 갱신.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-014
- `docs/adsense-checklist.md`
- `src/app/layout.tsx` — 푸터 구조 (line 157-230, footer 열고닫기)
- `src/app/sitemap.ts` — sitemap 생성 로직

## 기존 코드 참조 (실측)

- `src/app/layout.tsx:157` — `<footer ...>` 열기
- `src/app/layout.tsx:159` — `<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">` (grid 확장 대상)
- `src/app/layout.tsx:160` — Brand 섹션 주석
- `src/app/layout.tsx:173` — `<h3>바로가기</h3>`
- `src/app/layout.tsx:197` — `<h3>소셜</h3>`
- `src/app/layout.tsx:230` — `</footer>`
- `src/app/sitemap.ts:15-28` — `staticPages` 배열 (baseUrl 루트 + `/categories` 2개)

라인번호가 바뀌어 있으면 패턴 (`grid grid-cols-1 md:grid-cols-3 gap-8 mb-8`, `<h3>소셜</h3>`) 으로 위치 확정.

## 작업 목록 (총 4개)

### 1. 푸터에 "정책" 섹션 추가

`src/app/layout.tsx:159` 의 `grid grid-cols-1 md:grid-cols-3 gap-8 mb-8` 을 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8` 로 확장. md 에서 2열, lg 에서 4열로 자연스럽게 채워 중형 태블릿 cramping 회피.

기존 3개(Brand / 바로가기 / 소셜) 뒤, `</h3>소셜` 블록 닫힘 다음에 "정책" 섹션 추가:

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

- 모바일(`grid-cols-1`) 은 유지. `md:grid-cols-2` + `lg:grid-cols-4` 로 단계적 확장.
- 기존 내부 `<a href="/">`/`<a href="/categories">` 패턴 그대로 사용 (Next.js `<Link>` 안 써도 existing 패턴 일치 우선).

### 2. `sitemap.ts` 에 정책 페이지 3개 추가

`src/app/sitemap.ts` 의 `staticPages` 배열에 append (기존 2개 — 루트 + `/categories` 뒤에):

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

### 3. `docs/adsense-checklist.md` 체크박스 전수 갱신 (사전 조건 + 기술 준비)

plan004 이 main 에 merged (HEAD=2b0d514) 되어 "사전 조건" 도 모두 충족. plan005 완료로 "기술 준비" 도 충족. 따라서 두 섹션 9개 체크박스 **전부** `- [ ]` → `- [x]` 로 갱신.

**"0. 사전 조건" 3개** (plan004 완료 반영):

```diff
- - [ ] `blog.fosworld.co.kr` 메인 도메인 전환 완료 (ADR-013)
- - [ ] `https://blog.fosworld.co.kr/sitemap.xml` GSC 제출 완료
- - [ ] `https://blog.fosworld.co.kr/robots.txt` 접근 가능
+ - [x] `blog.fosworld.co.kr` 메인 도메인 전환 완료 (ADR-013, plan004 에서 완료)
+ - [x] `https://blog.fosworld.co.kr/sitemap.xml` GSC 제출 완료
+ - [x] `https://blog.fosworld.co.kr/robots.txt` 접근 가능
```

섹션 제목 `## 0. 사전 조건 (plan004 완료 후)` → `## 0. 사전 조건 (plan004 완료 — 2026-04-24 merged)` 로 갱신.

**"1. 기술 준비" 6개** (plan005 완료 반영):

```diff
- - [ ] `/privacy` — 개인정보처리방침 페이지 (indexable, 푸터 링크)
- - [ ] `/about` — 블로그 소개 (GitHub 프로필 연동)
- - [ ] `/contact` — 연락처 (이메일 + GitHub Issues)
- - [ ] 푸터에 정책 페이지 링크 노출
- - [ ] `sitemap.xml` 에 3개 페이지 포함
- - [ ] `src/app/ads.txt/route.ts` 동작 확인 (env 없이도 `# ads.txt not configured` 반환)
+ - [x] `/privacy` — 개인정보처리방침 페이지 (indexable, 푸터 링크)
+ - [x] `/about` — 블로그 소개 (GitHub 프로필 연동)
+ - [x] `/contact` — 연락처 (이메일 + GitHub Issues)
+ - [x] 푸터에 정책 페이지 링크 노출
+ - [x] `sitemap.xml` 에 3개 페이지 포함
+ - [x] `src/app/ads.txt/route.ts` 동작 확인 (env 없이도 `# ads.txt not configured` 반환)
```

섹션 제목 `## 1. 기술 준비 (plan005 완료 후)` → `## 1. 기술 준비 (plan005 완료 — 2026-04-24)` 로 갱신.

### 4. 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

빌드 산출물에 새 페이지 3개 디렉토리가 생성됐는지 디스크로 확인 (작업 `test -d` 는 성공 기준 #5).

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 푸터에 정책 섹션 추가
grep -n '"/privacy"' src/app/layout.tsx
grep -n '"/about"' src/app/layout.tsx
grep -n '"/contact"' src/app/layout.tsx
grep -n "개인정보처리방침" src/app/layout.tsx
grep -n "연락처" src/app/layout.tsx

# 2) 푸터 grid 확장 (md:2 → lg:4)
grep -nE "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" src/app/layout.tsx
! grep -nE "grid-cols-1 md:grid-cols-3 gap-8 mb-8" src/app/layout.tsx

# 3) sitemap 에 3개 URL 추가 (source 코드 기준 — Next 16 sitemap 은 dynamic 이라 빌드 산출물 grep 불신뢰)
#    grep -F 로 fixed string 검색 — `${baseUrl}` 의 `$` 가 BRE 앵커로 오해되지 않게
grep -nF '${baseUrl}/about' src/app/sitemap.ts
grep -nF '${baseUrl}/privacy' src/app/sitemap.ts
grep -nF '${baseUrl}/contact' src/app/sitemap.ts
[ "$(grep -cE 'baseUrl}/(about|privacy|contact)' src/app/sitemap.ts)" = "3" ]

# 4) adsense-checklist "0. 사전 조건" + "1. 기술 준비" 체크박스 전부 [x]
#    (두 섹션 이외엔 체크박스가 없어 전역 검증으로 충분)
! grep -nE "^- \[ \] " docs/adsense-checklist.md
grep -n "plan004 완료 — 2026-04-24 merged" docs/adsense-checklist.md
grep -n "plan005 완료 — 2026-04-24" docs/adsense-checklist.md

# 5) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 6) 빌드 산출물에 새 페이지 3개 포함
test -d .next/server/app/privacy
test -d .next/server/app/about
test -d .next/server/app/contact

# 7) 최종 diff 실측 (참고용 — 실패 조건 아님)
git diff --name-only
git diff --stat
```

## PHASE_BLOCKED 조건

- 푸터 grid 확장이 모바일/태블릿 레이아웃을 깨뜨림 → **PHASE_BLOCKED: Tailwind 반응형 클래스 조정 필요**
- `pnpm build` 실패 → **PHASE_BLOCKED: 로그 분석 필요**
- 빌드 산출물에 `/privacy`, `/about`, `/contact` 디렉토리 누락 → **PHASE_BLOCKED: Next.js App Router route 생성 재검증**

## 완료 후 team-lead 처리

- 통합 검증 재확인 (`pnpm lint && pnpm type-check && pnpm test --run && pnpm build`)
- 커밋 분리 (atomic):
  - `feat(pages): add privacy, about, contact pages for AdSense prerequisites`
  - `feat(config): allow avatars.githubusercontent.com for next/image` (`next.config.ts` phase-01 변경)
  - `feat(layout): add policy section to footer with responsive grid`
  - `feat(sitemap): include policy pages in sitemap`
  - `docs(adsense): mark technical prerequisites as completed`
- PR 제목: `feat(adsense): add policy/about/contact pages for approval (ADR-014)`
- PR 본문에 `docs/adsense-checklist.md` 링크 + 승인 신청 다음 단계 안내
- index.json `status: "completed"` 갱신 + 커밋 + push

## 커밋 제외 (phase 내부)

executor 는 이 phase 내부에서 커밋하지 않는다.
