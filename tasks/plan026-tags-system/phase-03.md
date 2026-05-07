# Phase 03 — 검증 + docs 갱신 + 마킹

**Model**: haiku

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/data-schema.md` 갱신

`posts` 테이블 정의에 `tags JSON[] NOT NULL DEFAULT []` 추가. 기존 `folders` 와 같은 방식으로 한 줄.

### 3. `docs/code-architecture.md` 갱신 (선택)

새 라우트 `/tag/[name]` 만 한 줄 추가. PostRepository.getPostsByTag 메서드명 언급.

### 4. issue close

PR body 에 `Closes #72` 명시 (PR 생성 시 작성).

### 5. index.json status 마킹

`tasks/plan026-tags-system/index.json` 의 phase 1/2/3 + 최상위 `status` = `"completed"`.

### 6. verification

```bash
grep -n "tags" docs/data-schema.md
grep -n "/tag/\[name\]" docs/code-architecture.md
grep -n "\"completed\"" tasks/plan026-tags-system/index.json | wc -l  # 4
```
