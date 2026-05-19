# Phase 02 — 검증 + docs + 마킹

**Model**: haiku

## 작업 항목

### 1. 통합 검증

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

### 2. `docs/pages/post-detail.md` 갱신

대상 섹션: "Layout" / "Components" / "Data" 표 (실제 문서 구조에 맞춰).

갱신 내용:
- 페이지 구조 다이어그램/리스트에 `ArticleFooter → <RelatedPosts /> → Comments` 명시 (기존 `ArticleFooter → Comments` 사이에 삽입)
- Data 표에 `relatedPosts: PostData[]` 항목 추가 — 출처 `PostRepository.getRelatedPosts(slug, 4)`, 매칭 기준 한 줄 ("같은 카테고리 + tag 교집합 desc, fallback: 카테고리 최근 글")
- "이런 글도" 섹션이 0개일 때는 컴포넌트가 `null` 반환하므로 페이지에서 사라진다는 점 한 줄 (edge case)

기존 Comments 관련 문구는 그대로 보존 — RelatedPosts 항목만 삽입.

### 3. index.json status 마킹

`tasks/plan034-related-posts/index.json`:
- 최상위 `status` = `"completed"`
- `phases[0].status` = `"completed"` (phase-01)
- `phases[1].status` = `"completed"` (phase-02 — 본 phase 자체)

PR 생성은 build-with-teams team-lead 가 본 phase 완료 후 처리. PR body 에 `Closes #128` 명시는 team-lead 책임.
