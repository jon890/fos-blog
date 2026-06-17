# ADR Index — 기술 결정 기록

이 문서는 **코드/설정/git log로 자명하지 않은 기술 결정**만 기록한다.
자명한 사항(파일 위치, 함수명, 단순 구현 선택)은 제외.
AI 에이전트가 설계 철학을 빠르게 추론하기 위한 컨텍스트.

**운영 규칙**: ADR 1개 = 파일 1개(`docs/adr/NNN-slug.md`) + 이 INDEX 에 링크 한 줄.
새 ADR 은 `docs/adr/NNN-slug.md` 생성 + 아래 적절한 분류에 링크를 추가한다.
결번(012 등)은 재사용하지 않는다(결번 보존).

---

## 콘텐츠 & UX

- [ADR-001](./001-infinite-scroll-page.md) — 무한 스크롤 페이지 (SSR 첫 페이지 + 클라이언트 fetch 하이브리드)
- [ADR-003](./003-home-entry-ux.md) — 홈 진입 UX (섹션 하단 CTA 버튼, 카테고리 링크와 차별화)
- [ADR-005](./005-list-page-noindex.md) — 리스트 페이지 `noindex` (`/posts/latest|popular`)
- [ADR-006](./006-intersection-observer.md) — IntersectionObserver 직접 구현 (의존성 0)
- [ADR-010](./010-strip-leading-h1.md) — Markdown 본문 선두 H1 제거 (`stripLeadingH1`)
- [ADR-022](./022-about-page.md) — About 페이지 co-located CSS + 2-stage avatar
- [ADR-024](./024-rss-feed.md) — RSS feed (RSS 2.0 + pubDate=createdAt)

## 데이터 & API

- [ADR-002](./002-pagination.md) — 페이지네이션 (최신=cursor, 인기=offset+pagePath)
- [ADR-004](./004-infinite-scroll-api-route.md) — 무한 스크롤 데이터 fetch = API Route
- [ADR-023](./023-tag-system.md) — 태그 시스템 (posts.tags JSON + JSON_CONTAINS)
- [ADR-025](./025-series-system.md) — 시리즈 시스템 (posts.series VARCHAR + series_order INT + 양쪽 필수, plan033)
- [ADR-030](./030-multi-category.md) — 다중 카테고리 (경로 primary + frontmatter 추가, 카테고리 페이지 cross-post 노출, plan051)

## OG 이미지 & 공유

- [ADR-007](./007-og-image-hybrid.md) — `next/og` 동적 + 정적 fallback 하이브리드
- [ADR-008](./008-og-font-pretendard.md) — Pretendard subset WOFF 로컬 번들 (UI/OG 통일)
- [ADR-009](./009-og-nodejs-runtime.md) — `ImageResponse` 런타임 = Node.js
- [ADR-011](./011-og-catchall-api-route.md) — catch-all OG 이미지 = API Route 우회

## 도메인 & SEO 검색 노출

- [ADR-013](./013-main-domain.md) — 메인 도메인 단일화 (`blog.fosworld.co.kr`, `/ads.txt` 만 예외)
- [ADR-014](./014-adsense-approval.md) — AdSense 승인 요건 (privacy/about/contact + GitHub 프로필 fetch)

## 보안 & 안정성

- [ADR-015](./015-visit-tracking.md) — Visit tracking 경로 유효성 + middleware 분리
- [ADR-016](./016-rate-limiting.md) — Rate limit middleware (1000/min/IP, RFC1918 우회, Googlebot|Bingbot|NaverBot|Yeti 예외)
- [ADR-018](./018-db-migration-auto.md) — DB 마이그레이션 자동화 (컨테이너 부팅 시 drizzle migrator 실행)

## 디자인 시스템

- [ADR-017](./017-design-system.md) — Vercel 베이스 + Stripe 액센트 + Geist/Pretendard + shadcn 최신 (Claude Design 워크플로우)
- [ADR-029](./029-design-md.md) — DESIGN.md 자립형 도입 + globals.css 를 토큰 source of truth 로 유지

## 마크다운 / 콘텐츠 렌더

- [ADR-019](./019-code-highlight.md) — 코드 블록 하이라이팅 (rehype-pretty-code + shiki dual theme)
- [ADR-020](./020-markdown-unified-async.md) — 마크다운 변환 react-markdown → unified async (server component, plan014)
- [ADR-021](./021-comment-design.md) — 댓글 디자인 라이브러리 + 보안 정책 (rhf + zod + sonner / escapeHtml 단방향 / USER_FRIENDLY_ERRORS / og-palette 분리, plan022)
- [ADR-026](./026-markdown-sanitize.md) — Markdown 렌더 sanitize 도입 (rehype-sanitize + defaultSchema 확장, plan029)
- [ADR-027](./027-katex.md) — KaTeX 수식 렌더링 도입 (remark-math + rehype-katex output:"html", plan044)

## 컴포넌트 분리

- [ADR-028](./028-series-card.md) — 시리즈 인덱스 카드는 PostCard variant 가 아닌 별도 SeriesCard 컴포넌트 (plan047)

## 메타 / 문서 구조

- [ADR-031](./031-adr-file-split.md) — ADR 파일 분리 (단일 adr.md → docs/adr/NNN-slug.md, plan052)
