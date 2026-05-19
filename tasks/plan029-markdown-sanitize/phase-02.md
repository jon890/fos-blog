# Phase 02 — 검증 + ADR-026 신규 + 마킹

**Model**: haiku
**Goal**: phase 1 결과 통합 검증 + `docs/adr.md` 에 신규 **ADR-026 (Markdown sanitize 정책)** 추가 + index.json 마킹.

## 작업 항목

### 1. 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/adr.md` 에 ADR-026 추가

기존 ADR 본문은 수정 금지 (ADR-020 은 plan014 의 unified async 전환 결정, ADR-021#5 는 댓글 plain-text escape 결정 — 둘 다 본 plan 과 다른 결정).
파일 말미 (ADR-025 다음) 에 **신규 ADR-026** 추가:

```markdown
<a id="adr-026"></a>

## ADR-026. Markdown 렌더 sanitize 도입 (plan029)

- **결정**: `unified` 파이프라인 말미에 `rehype-sanitize` 추가. `defaultSchema` 를 확장해 rehype-pretty-code (shiki) data-* + figure/figcaption + rehype-slug heading id 를 allowlist 에 등록. `<script>` / `<iframe>` / `on*` 핸들러 / `javascript:` URL 은 차단.
- **맥락**: ADR-020 (plan014) 의 unified async 전환 시 `allowDangerousHtml: true` + `rehypeRaw` 가 도입되어 글 본문의 raw HTML 이 hast 트리로 그대로 변환됨. 콘텐츠 출처가 `jon890/fos-study` 자기 소유라 즉각 위험은 낮지만 (1) fos-study compromise, (2) 외부 contributor 도입, (3) 향후 댓글 markdown 렌더 가능성 대비 baseline 보안 가드 필요. ADR-021#5 의 댓글 XSS 정책은 plain-text + JSX auto-escape 라 본 결정과 무관.
- **대안 기각**:
  - **Option B — `rehypeRaw` + `allowDangerousHtml` 제거**: fos-study 글의 기존 raw HTML 사용 영향 예측 비용 큼. 글 작성자가 `<details>` / `<sub>` / 인라인 HTML 활용 중일 가능성. 회귀 범위 너무 넓음
  - **DOMPurify (client 측)**: server component 에서 렌더되므로 hast 단계에서 처리하는 게 자연. DOM 단계는 사후 처리라 SSR HTML 에 이미 위험 노출
- **트레이드오프**: shiki/pretty-code 가 새 data-* 속성을 추가하면 allowlist 보강 필요. mermaid SVG 는 본 ADR 에서 OOS — `defaultSchema` 의 SVG tagNames 미허용으로 다이어그램이 strip 가능. follow-up plan 에서 처리.
```

### 3. issue close

PR body 에 `Closes #84` `Closes #79` 명시 (PR 생성 시 작성, 본 phase 직접 수행 안 함).

### 4. index.json status 마킹

`tasks/plan029-markdown-sanitize/index.json`:
- 최상위 `status` = `"completed"`
- `phases[0].status` = `"completed"`
- `phases[1].status` = `"completed"`

### 5. verification

```bash
# cwd: <worktree root>
grep -n "ADR-026\|adr-026" docs/adr.md   # 본문 + anchor 모두 존재해야
grep -c "\"completed\"" tasks/plan029-markdown-sanitize/index.json   # 3
```
