## ADR-007. OG 이미지 — `next/og` 동적 + 정적 fallback 하이브리드

**Context**: `layout.openGraph.images` 미설정 → 공유 시 이미지 없음. `ArticleJsonLd.publisher.logo` 가 실존 안 하는 `/icon` URL → Rich Results 검증 실패.

**Decision**:

- **정적 fallback**: `public/og-default.png` (1200×630), `public/logo.png` (512×512) — `layout.tsx` 기본값 + `JsonLd` publisher.logo
- **동적 생성**: `next/og` `ImageResponse` — 페이지마다 제목/발췌/카테고리 배지 렌더
  - 단일 dynamic: `opengraph-image.tsx` (홈, categories)
  - catch-all: `/api/og/{scope}/[...x]/route.tsx` (ADR-011)
- **ISR**: `revalidate = 60` (양쪽 동등)

**Why**: 공유 시 제목 노출로 CTR 극대화 + standalone 호환 + fallback 보험. 정적 1장(글마다 동일, 변별력 없음)/SSG pre-render(빌드 시간 + 글 수정 반영 지연) 기각. 공용 유틸 `src/lib/og.ts` 로 스타일/폰트/로고 embedding 중앙 관리.
