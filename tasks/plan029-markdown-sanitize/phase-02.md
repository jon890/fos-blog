# Phase 02 — 검증 + ADR-020 갱신 + 마킹

**Model**: haiku
**Goal**: phase 1 결과 통합 검증 + ADR-020 (Markdown 보안 정책) 갱신 + index.json 마킹.

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/adr.md` ADR-020 갱신

기존 ADR-020 (Markdown sanitize 미도입 결정) 본문 갱신 — 위협 모델 확장 + rehype-sanitize 도입 결정. 기존 결정은 삭제하지 말고 "재평가" 단락으로 남겨 의도 보존:

```markdown
- **재평가 (2026-05-07, plan029)**: rehype-sanitize 도입 결정.
  - **이유**: 댓글 영역 markdown 렌더 가능성 + fos-study 외부 contributor 가능성 + 일반 보안 베이스라인.
  - **변경**: unified pipeline 말미에 rehype-sanitize 추가, defaultSchema 확장으로 shiki / pretty-code / heading id allowlist.
```

### 3. issue close

PR body 에 `Closes #84` `Closes #79` 명시 (이미 PR 생성 시 작성).

### 4. index.json status 마킹

`tasks/plan029-markdown-sanitize/index.json` 의 phase 1/2 + 최상위 `status` = `"completed"`.

### 5. verification

```bash
grep -n "rehype-sanitize\|plan029" docs/adr.md
grep -n "\"completed\"" tasks/plan029-markdown-sanitize/index.json | wc -l  # 3
```
