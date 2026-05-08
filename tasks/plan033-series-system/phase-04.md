# Phase 04 — 검증 + docs + 마킹

**Model**: haiku

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. docs 갱신

- `docs/data-schema.md`: `posts` 테이블에 `series VARCHAR(255) NULL` + `series_order INT NULL` 추가
- `docs/code-architecture.md`: `/series/[name]` 라우트 + PostRepository series 메서드 한 줄
- `docs/pages/post-detail.md`: ArticleHero 의 series 메타 + ArticleFooter prev/next 카드 섹션 한 단락
- `docs/pages/home.md`: HomeHero 의 seriesCount 실값 연결 한 줄

### 3. issue close

PR body 에 `Closes #127` 명시.

### 4. index.json status 마킹

phase 1/2/3/4 + 최상위 `status` = `"completed"` (총 5개 "completed" 토큰).

### 5. verification

```bash
grep -n "series" docs/data-schema.md
grep -n "/series/" docs/code-architecture.md
grep -n "\"completed\"" tasks/plan033-series-system/index.json | wc -l  # 5 (top + phase 1/2/3/4)
```
