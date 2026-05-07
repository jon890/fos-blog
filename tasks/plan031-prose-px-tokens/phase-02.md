# Phase 02 — 검증 + 마킹

**Model**: haiku

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. issue close

PR body 에 `Closes #75` 명시.

### 3. index.json status 마킹

`tasks/plan031-prose-px-tokens/index.json` 의 phase 1/2 + 최상위 `status` = `"completed"`.
