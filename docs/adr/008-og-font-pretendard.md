## ADR-008. 동적 OG 폰트 — Pretendard subset WOFF 로컬 번들 (UI/OG 통일)

**Context**: `ImageResponse` (satori) 한글 렌더에 폰트 필수. CDN fetch 는 홈서버 네트워크 의존. plan021 에서 OG 디자인을 plan009 기반으로 갱신하면서 UI 폰트(ADR-017 — Pretendard) 와 통일 결정.

**Decision**: Pretendard Bold subset 을 `public/fonts/Pretendard-Bold-subset.woff` 로 번들 (~350KB, npm `pretendard@1.3.9` 의 `dist/web/static/woff-subset/Pretendard-Bold.subset.woff`). `src/lib/og.ts` `loadOgFont()` 가 `process.cwd()` 기반으로 로드, `ImageResponse.fonts: [{ name: "Pretendard", data, weight: 700, style: "normal" }]` 전달. 4개 라우트 (`api/og/posts/[...slug]`, `api/og/category/[...path]`, `app/opengraph-image`, `app/categories/opengraph-image`) 모두 동일.

**Why**:
- **Pretendard 채택**: UI 폰트(ADR-017)와 통일 → OG 이미지의 한글 톤이 사이트 본문과 일치. plan009 디자인 시스템의 핵심 폰트.
- **WOFF 채택 (plan021 검증)**: Pretendard TTF 가 npm 패키지 + jsdelivr CDN 모두 미존재 (woff/woff2 만 배포). satori 는 TTF/OTF/**WOFF** 지원, **WOFF2 만 미지원** — WOFF 는 직접 검증 시 정상 렌더. 이전 ADR 의 "woff 호환 불확실" 가정 폐기.
- **subset 350KB**: Noto KR full 1.6MB 대비 서버 번들 부피 감소. Pretendard subset 은 KS X 1001 + 자주 쓰는 신조어 커버.
- **외부 의존 0**: 홈서버 네트워크 차단 환경에서도 OG 동작 보장. Dockerfile `COPY public` 으로 함께 번들.
- 기각: Google Fonts fetch (네트워크 의존), Noto Sans KR (UI 와 분리되어 톤 불일치), woff2 (satori 미지원).

**Scope 명시**: OG 이미지 생성 전용 (서버 사이드 satori). UI 렌더링 폰트는 [ADR-017](./017-design-system.md) 참조. 이번 ADR 갱신으로 두 ADR 의 폰트 패밀리가 일치.
