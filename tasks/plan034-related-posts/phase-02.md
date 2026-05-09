# Phase 02 — 검증 + docs + 마킹

**Model**: haiku

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/pages/post-detail.md` 갱신

페이지 구조 한 단락 갱신: `ArticleFooter` 다음에 `RelatedPosts` 섹션 추가, 그 아래 `Comments`. 매칭 기준 한 줄 (같은 카테고리 + tag 교집합 desc).

### 3. issue close

PR body 에 `Closes #128` 명시.

### 4. index.json status 마킹

phase 1/2 + 최상위 `status` = `"completed"`.
