## ADR-017. 디자인 시스템 — Vercel 베이스 + Stripe 액센트 + Geist/Pretendard + shadcn 최신

**Context**: 현재 디자인이 generic Tailwind look (gray + blue + rounded-xl + shadow-md) 으로 시각적 정체성 부족. 컬러 토큰 정의는 있으나 실제 사용 안 됨, shadcn/ui 미도입으로 UI 모두 자체 구현, Hero/PostCard 등 13개 문제점 식별 (참조: `docs/design-inspiration.md`).

**Decision**:

- **톤**: **Vercel 베이스** (pure black/white + 시안/블루 액센트, 절제, 미세 grid + 1px border, 작은 radius) + **Stripe 그라디언트 mesh** (hero 영역만) + **Linear** 의 큰 hero 텍스트 일부 차용
- **폰트**: 영문 **Geist Sans/Mono** (`geist` npm 패키지) + 한글 **Pretendard** (CDN) — Geist 와 톤 매칭 + 한글 가독성
- **컴포넌트 base**: **shadcn/ui 최신** (Tailwind v4 호환) — Dialog/Button/Card/Tooltip 등 도입. SearchDialog, Comments 등 자체 구현 점진 교체
- **모션**: **motion-one** (~3KB, Framer Motion 경량 alt) — 미세 page transition + hover 디테일
- **다크 우선**: default `dark` 유지 (Vercel/Linear 컨벤션, 현 동작과 일치)
- **토큰 시스템**: Tailwind v4 `@theme` 블록 (`globals.css`) 으로 표준화 — 컬러/타이포/spacing/radii/shadows/motion primitives
- **카테고리 9종 (canonical)**: `ai / algorithm / db / devops / java / js / react / next / system` — oklch chroma 0.09, lightness 0.74 (dark) / 0.50 (light). 데이터의 raw 카테고리 키 (architecture/network/interview/kafka/internet 등) 는 헬퍼 (`src/lib/category-meta.ts`, plan010) 에서 9종 중 하나로 정규화 (미매핑 → `system`)
- **OG / Avatar 팔레트는 7색 부분집합** (plan021/022): `og-palette.ts` 의 `OG_CATEGORY_HEX` 는 9종 중 `next` / `system` 제외한 7개만 hex 매핑. 이유: hash % palette.length 라 색 다양성만 충분하면 되고 `system` 은 fallback (`OG_CATEGORY_DEFAULT_HEX` brand teal) 와 의미가 겹침. `next` 는 forward-compat 자리
- **워크플로우**: Claude Design (Anthropic Labs Research Preview) 으로 mockup 생성 → 이 저장소에서 코드 구현. 단계별 프롬프트는 `docs/design-inspiration.md`

**Why**:

- **개발자 정체성**: 모던 dev-tool 사이트 (Vercel/Linear/Stripe) 톤이 기술 블로그와 자연스럽게 매치 + 운영자 1인 개발자 브랜드와 일관
- **외부 의존성 최소**: shadcn (소스 복사 모델, lock-in 없음) + motion-one (3KB) + Geist npm + Pretendard CDN — 합산해도 번들 영향 작음
- **한글 가독성 보존**: Pretendard 가 한글 dev-blog 사실상 표준. Geist 와 미세 매칭 양호
- **Claude Design 활용**: mockup → 코드 분리로 시각 합의 후 구현 → iteration 비용 절감
