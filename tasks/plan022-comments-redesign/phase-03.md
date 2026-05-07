# Phase 03 — 검증 + docs 갱신 + 마킹

**Model**: haiku
**Goal**: phase 1+2 결과의 통합 검증 + post-detail.md 갱신 + index.json status 마킹.

## 작업 항목

### 1. 통합 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

오류 0건. 오류 있으면 phase 2 로 돌려 수정 후 재실행.

### 2. `docs/pages/post-detail.md` 댓글 섹션 갱신

기존 댓글 영역 설명을 plan022 기준으로 한 단락 갱신:
- 컴포넌트 분리: `Comments` (컨테이너) / `CommentForm` / `CommentItem` / `DeleteConfirmDialog` / `Avatar`
- 폼 검증: react-hook-form + zod
- 알림: sonner toast
- 아바타: nickname hash 기반 색상 자동 선택 (`OG_CATEGORY_HEX` 의 7색 팔레트 재사용 — plan021 단일 소스)
- threading 미포함 (의도적 — schema 변경 회피)

기존 내용이 자세히 들어가 있다면 짧게 (3~4줄) 압축. docs 작성 원칙 준수 — 컨텍스트 효율.

### 3. `tasks/plan022-comments-redesign/index.json` status 마킹

`status` 와 phase 1/2/3 의 `status` 모두 `"completed"` 로 갱신.

### 4. 자동 verification

```bash
# cwd: <repo root>
grep -n "plan022\|CommentForm\|Avatar" docs/pages/post-detail.md | head -5
grep -n "\"completed\"" tasks/plan022-comments-redesign/index.json | wc -l  # 4 (top + 3 phases)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `docs/pages/post-detail.md` | 수정 |
| `tasks/plan022-comments-redesign/index.json` | 수정 (status) |
