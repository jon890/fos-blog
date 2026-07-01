## ADR-027. KaTeX 수식 렌더링 도입 (plan044)

- **결정**: unified 파이프라인에 `remark-math` (remark 단계) + `rehype-katex` (rehype 단계, `output: "html"`) 추가. `throwOnError` 는 rehype-katex 7.x Options 타입에서 Omit — 라이브러리 내부 기본값 `false` 에 의존. `sanitize-schema.ts` 의 `attributes.span` 에 `aria-hidden` 한 entry 추가 (KaTeX html fallback 영역 보존). `globals.css` 에 `@import "katex/dist/katex.min.css"` + `.prose .katex { color: inherit }` 다크모드 override + `.prose .katex-error { color: #cc0000 }` 오류 색 복원.
- **맥락**: `jon890/fos-study` 글에 LaTeX 수식 (`$x^2$` 인라인, `$$...$$` 블록) 사용 증가. unified async 파이프라인 (ADR-020) 위에서 plugin 두 개로 통합 가능. ADR-026 의 sanitize 단계 뒤에서 KaTeX 출력이 strip 되지 않도록 plugin 순서와 allowlist 정합 필요.
- **대안 기각**:
  - **MathJax** 기각 — 번들 크기 큼, unified/remark 생태계와 직접 통합 어려움. rehype-katex 는 hast plugin 으로 파이프라인 체인 자연 삽입.
  - **`output: "htmlAndMathml"` (rehype-katex 기본값)** 기각 — Safari 와 Chrome 의 MathML 렌더 차이 큼. HTML span 출력이 모든 모던 브라우저 일관. `<math>` / `<annotation>` sanitize allowlist 추가 불필요 → 범위 최소화.
  - **sanitize span 에 `["className", /^katex/]` regex 추가** 기각 — 기존 단순 `"className"` entry 가 이미 모든 값 통과 (shiki 토큰 색 보존 목적, ADR-026). regex 는 OR 동작이라 효과 없고, 좁히면 shiki 회귀.
- **트레이드오프**:
  - rehype-katex major 버전 업그레이드 시 `throwOnError` 기본값 변경 가능 — 회귀 주의 (현재는 7.x 의 Options 타입 Omit + 내부 false 보장).
  - KaTeX CSS 전역 import (~50KB gzip) — 모든 페이지 로드. 수식 사용 페이지가 한정적이라면 page 단위 lazy 검토 가능 (현재 OOS).
  - mathml 모드 전환 시 sanitize allowlist 에 `math` / `annotation` 태그 추가 + Safari MathML 렌더 차이 대응 별도 plan 필요.
