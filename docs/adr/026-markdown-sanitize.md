## ADR-026. Markdown 렌더 sanitize 도입 (plan029)

- **결정**: `unified` 파이프라인 말미에 `rehype-sanitize` 추가. `defaultSchema` 를 확장해 rehype-pretty-code (shiki) data-* + figure/figcaption + rehype-slug heading id 를 allowlist 에 등록. `<script>` / `<iframe>` / `on*` 핸들러 / `javascript:` URL 은 차단.
- **맥락**: ADR-020 (plan014) 의 unified async 전환 시 `allowDangerousHtml: true` + `rehypeRaw` 가 도입되어 글 본문의 raw HTML 이 hast 트리로 그대로 변환됨. 콘텐츠 출처가 `jon890/fos-study` 자기 소유라 즉각 위험은 낮지만 (1) fos-study compromise, (2) 외부 contributor 도입, (3) 향후 댓글 markdown 렌더 가능성 대비 baseline 보안 가드 필요. ADR-021#5 의 댓글 XSS 정책은 plain-text + JSX auto-escape 라 본 결정과 무관.
- **대안 기각**:
  - **Option B — `rehypeRaw` + `allowDangerousHtml` 제거**: fos-study 글의 기존 raw HTML 사용 영향 예측 비용 큼. 글 작성자가 `<details>` / `<sub>` / 인라인 HTML 활용 중일 가능성. 회귀 범위 너무 넓음
  - **DOMPurify (client 측)**: server component 에서 렌더되므로 hast 단계에서 처리하는 게 자연. DOM 단계는 사후 처리라 SSR HTML 에 이미 위험 노출
- **트레이드오프**:
  - shiki/pretty-code 가 새 data-* 속성을 추가하면 allowlist 보강 필요.
  - mermaid SVG 는 본 ADR 에서 OOS — `defaultSchema` 의 SVG tagNames 미허용으로 다이어그램이 strip 가능. follow-up plan 에서 처리.
  - **`clobberPrefix: ""` 로 override** — `defaultSchema.clobberPrefix` 기본값 `"user-content-"` 가 heading id 에 prefix 를 붙여 rehype-slug 가 만든 TOC/in-page 앵커 (`#hello-world` → `#user-content-hello-world`) 가 깨짐. 빈 문자열로 override 해 원본 slug 보존. **전제**: 콘텐츠 출처가 `jon890/fos-study` 신뢰된 markdown 만, 사용자 입력 HTML 직접 노출 없음 → DOM clobbering 위험 낮음. 향후 댓글 markdown 도입 시 재검토.
