# Phase 02 — 검증 + smoke 가이드 + issue close + 마킹

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

본문 영역 모바일 정책 1단락 추가:
- inline code: token 보존 wrap (keep-all + overflow-wrap)
- 테이블: 모바일 가로 스크롤 wrapper
- 코드 블록: 가로 스크롤 명시

### 3. issue close

PR body 에 `Closes #136 #137 #138` 명시.

### 4. index.json status 마킹

phase 1/2 + 최상위 `status` = `"completed"`.

### 5. verification

```bash
grep -n "\"completed\"" tasks/plan035-mobile-readability-fix/index.json | wc -l  # 3
```
