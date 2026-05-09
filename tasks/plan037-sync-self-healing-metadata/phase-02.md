# Phase 02 — 검증 + docs + close + 마킹

**Model**: haiku

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/code-architecture.md` 갱신

- `CategoryRepository.replaceAll` → `syncAll` 명칭 변경 + UPSERT + orphan DELETE 패턴 한 줄
- `SyncService` 의 short-circuit path 도 metadata 재계산 한 줄

### 3. issue close

PR body 에 `Closes #145` 명시.

### 4. index.json status 마킹

phase 1/2 + 최상위 `status` = `"completed"`.
