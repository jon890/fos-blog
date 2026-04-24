# Phase 01 — 정책/소개 페이지 3개 + next.config avatars 패턴

## 컨텍스트 (자기완결 프롬프트)

AdSense 승인 요건 충족을 위해 `/privacy`, `/about`, `/contact` 페이지 3개를 신규 추가 (ADR-014). About 페이지는 GitHub 프로필을 런타임 fetch + ISR 1시간으로 렌더. 푸터/sitemap 연결은 phase-02 에서.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-014 (AdSense 승인 요건, 수집 데이터 공개 범위)
- `docs/adsense-checklist.md` — 신청 절차
- `src/app/categories/page.tsx` — 기존 단순 페이지 metadata 패턴
- `src/app/layout.tsx` — 루트 metadata
- `src/env.ts` — env 참조 패턴
- `.claude/skills/_shared/common-critic-patterns.md` — BLG2 (logger 4-field), BLG3 (사일런트 실패 금지)

## 기존 코드 참조

- `src/infra/db/schema/visitLogs.ts` — `ipHash` SHA-256 수집 내용 (Privacy Policy 설명 근거)
- `src/infra/db/schema/comments.ts` — 댓글 닉네임 + bcrypt 해시 저장 (Privacy Policy 설명 근거)
- `next.config.ts` — `images.remotePatterns` 기존 구조
- `src/app/categories/page.tsx` — metadata + ISR + DB 에러 fallback 패턴
- `src/lib/logger.ts` — `logger.child({ module })` 컨벤션

## 작업 목록 (총 4개)

### 1. `/privacy` 페이지 — 개인정보처리방침

파일: `src/app/privacy/page.tsx`

요구사항:
- Server Component (서버 렌더), `export const revalidate = 86400` (하루)
- `metadata`: title "개인정보처리방침", description, canonical `${siteUrl}/privacy`, robots index:true follow:true
- 평이한 한국어 (법률 용어 X)
- 섹션:
  1. **수집하는 정보**
     - 방문 통계: IP 주소의 SHA-256 해시 (원본 복원 불가, 하루 단위 중복 방문 판별 목적)
     - 댓글: 닉네임(공개), 비밀번호(bcrypt 해시), 댓글 본문. IP 미수집
     - 쿠키/로컬스토리지: 테마(light/dark) 설정
  2. **이용 목적**
     - 통계 (방문자 추이)
     - 댓글 작성자 본인 확인
     - 사용자 환경 맞춤 (테마)
  3. **제3자 제공**
     - Google AdSense: 광고 개인화 쿠키 (Google 소유, Google 정책 따름)
     - 링크: https://policies.google.com/technologies/partner-sites (한국어)
     - 현재 Google Analytics 미사용
  4. **보관 기간**
     - 방문 로그: 무기한 (해시 기반이라 개인 식별 불가)
     - 댓글: 게시자가 비밀번호로 삭제 가능, 그 외 무기한
  5. **문의**
     - `/contact` 페이지 참조
  6. **개정 이력**: 2026-04-24 최초 게시

- 디자인: 기존 블로그 page 와 동일한 컨테이너(`container mx-auto px-4 py-6 md:py-12`) + prose 스타일
- heading 은 h1 (타이틀) + h2 (섹션)
- DB 접근 없음 — 순수 정적 콘텐츠

### 2. `/contact` 페이지 — 연락처

파일: `src/app/contact/page.tsx`

요구사항:
- Server Component, metadata (canonical indexable)
- 섹션:
  1. 이메일: `jon89071@gmail.com` (mailto 링크)
  2. GitHub Issues: `https://github.com/jon890/fos-study/issues` — "블로그 콘텐츠 오류 제보·주제 제안"
  3. 응답 시간 안내 (평일 기준 2~3일 내)
- 외부 링크는 `target="_blank" rel="noopener noreferrer"`
- 접근성: `<a>` 에 `aria-label` 제공

### 3. `/about` 페이지 — GitHub 프로필 연동

파일: `src/app/about/page.tsx`

요구사항:
- Server Component, `export const revalidate = 3600` (GitHub 프로필 ISR 1시간)
- metadata (canonical indexable)
- GitHub API 호출:
  ```ts
  const res = await fetch("https://api.github.com/users/jon890", {
    next: { revalidate: 3600 },
    headers: { Accept: "application/vnd.github+json" },
  });
  ```
- 성공 시 `{ name, avatar_url, bio, html_url, public_repos, followers }` 추출
- **실패 시 fallback** (BLG3 사일런트 실패 금지):
  - `logger.child({ module: "app/about" }).warn({ component: "about", operation: "github-profile", err, status }, "github profile fetch failed")`
  - 아바타 없이 텍스트만 렌더 (이름 = "jon890", bio = "")
- 렌더 구성 (ADR-014):
  1. 상단 카드: `next/image` 아바타 (실패 시 생략) + name + bio + GitHub 링크
  2. "블로그 소개" — FOS Study 는 개발 학습 기록 블로그 / 다루는 주제
  3. "다루는 주제" — 리스트 (AI, 알고리즘, 자료구조, 데이터베이스, DevOps, Java/Spring, JavaScript/TypeScript, React, Next.js)
  4. "블로그 기술 스택" — Next.js 16, TypeScript, MySQL, Drizzle ORM, Tailwind 4
  5. "콘텐츠 소스" — 이 블로그의 글은 [jon890/fos-study](https://github.com/jon890/fos-study) 리포지터리에서 동기화

### 4. `next.config.ts` — GitHub 아바타 도메인 추가

기존 `images.remotePatterns` 에 append:

```ts
{
  protocol: "https",
  hostname: "avatars.githubusercontent.com",
},
```

기존 2개(`raw.githubusercontent.com`, `github.com`) 는 유지. 이로써 `next/image` 가 `avatars.githubusercontent.com/u/...` 을 optimized 로 렌더 가능.

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 페이지 파일 3개 존재
test -f src/app/privacy/page.tsx
test -f src/app/about/page.tsx
test -f src/app/contact/page.tsx

# 2) Server Component (use client 없음)
! grep -l '"use client"' src/app/privacy/page.tsx src/app/about/page.tsx src/app/contact/page.tsx

# 3) metadata canonical / indexable
grep -nE 'canonical.*privacy' src/app/privacy/page.tsx
grep -nE 'canonical.*about' src/app/about/page.tsx
grep -nE 'canonical.*contact' src/app/contact/page.tsx

# 4) About 의 GitHub API 호출 + ISR 1시간
grep -n "api.github.com/users/jon890" src/app/about/page.tsx
grep -nE "revalidate:\s*3600" src/app/about/page.tsx

# 5) About fallback + BLG2 4-field 로깅
grep -nE "logger.*warn" src/app/about/page.tsx
grep -nE 'component:\s*"about"' src/app/about/page.tsx
grep -nE 'operation:\s*"github-profile"' src/app/about/page.tsx

# 6) next.config avatars 도메인 추가
grep -n "avatars.githubusercontent.com" next.config.ts

# 7) Privacy 내용 키워드 (수집 항목 설명)
grep -n "SHA-256" src/app/privacy/page.tsx
grep -n "bcrypt" src/app/privacy/page.tsx
grep -n "AdSense" src/app/privacy/page.tsx

# 8) Contact 내용
grep -n "jon89071@gmail.com" src/app/contact/page.tsx
grep -n "jon890/fos-study/issues" src/app/contact/page.tsx

# 9) 금지사항
! grep -nE "console\.(log|info|warn)" src/app/privacy/page.tsx src/app/about/page.tsx src/app/contact/page.tsx
! grep -nE "as any" src/app/privacy/page.tsx src/app/about/page.tsx src/app/contact/page.tsx

# 10) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

## PHASE_BLOCKED 조건

- GitHub API 응답 구조가 docstring 과 다름 → **PHASE_BLOCKED: API 응답 예시 재확인 후 필드 매핑**
- `next/image` 가 `avatars.githubusercontent.com` 을 여전히 차단 → **PHASE_BLOCKED: next.config 설정 문법 재검증**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다.
