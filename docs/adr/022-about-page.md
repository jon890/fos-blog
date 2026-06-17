## ADR-022. About 페이지 — co-located CSS + 2-stage avatar (plan023)

**Context**: plan023 에서 `/about` 을 Claude Design mockup 시각 사양으로 전면 리디자인. 기존 Tailwind utility-first 컨벤션과 다른 CSS 전략 + GitHub avatar 표시 방식 두 결정이 비자명.

**Decision**:

1. **co-located CSS (`src/app/about/about.css`)**: `import "./about.css"` 로 page.tsx 에 주입. `.ab-*` BEM-ish prefix 클래스 사용. Tailwind utility 가 아닌 CSS 파일로 분리.
2. **2-stage avatar**: `.ab-avatar` 컨테이너에 항상 이니셜 (`<span className="ab-avatar-initial">`) 렌더 → GitHub `avatarUrl` 있으면 그 위에 `<Image className="ab-avatar-img" position:absolute inset:0>` 로 덮음. fetch 실패 / 부재 시 이니셜이 그대로 보임.

**Why**:

- **co-located CSS**: mockup 의 `::before`/`::after` 로 그리는 hairline 액센트, `@keyframes ab-pulse` (LAST SYNC 카드 발광), `oklch(0.74 0.09 ${hue})` 동적 chip dot 색은 Tailwind arbitrary value 만으로 표현이 어색하거나 불가능. about 한 페이지 한정이라 globals.css 오염 회피 + 모듈 단위 격리 효과. 향후 다른 페이지가 비슷한 패턴이면 ADR 갱신 후 일반 utility 화 검토.
- **2-stage avatar**: GitHub API 일시 장애 / rate limit 시 페이지 그래픽 깨짐 방지. fallback 분기를 ProfileCard 안에 if/else 로 두는 대신 디자인 자체가 두 표시 상태를 항상 처리하도록 설계 — default (이니셜) → enhanced (사진 덮음). mockup 의 gradient + initial 컨테이너는 fallback 이 아니라 base layer 라는 의도.

**Scope 명시**: 이 ADR 의 결정은 about 페이지 한정. 다른 페이지가 동일 패턴 도입 시 본 ADR 의 근거 (`::after` hairline / `@keyframes` / 동적 oklch / API 폴백) 가 모두 해당하는지 재검토.
