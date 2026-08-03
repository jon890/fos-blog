# Phase 03 — 공유 메타데이터와 통합 검증

**Execution profile**: fast
**Status**: completed

---

## 목표

글 전용 썸네일을 공유 메타데이터에도 연결하고 최신 5개 실제 콘텐츠와 전체 검증으로 기능을 마무리한다.

**범위 외**: 추가 글 이미지 일괄 생성, 배포, 운영 DB 직접 수정.

---

## 작업 항목 (4)

### 1. 글 공유 메타데이터 우선순위

`src/app/posts/[...slug]/page.tsx`는 `data.post.thumbnailUrl`이 있으면 Open Graph와 X 카드 이미지로 사용한다.
전용 URL이 없으면 기존 `/api/og/posts/[...slug]`를 유지한다.
전용 이미지의 실제 크기를 DB에 저장하지 않으므로 크기를 추측해 선언하지 않는다.

### 2. API와 직렬화 회귀

최신·인기 추가 조회 응답이 `thumbnailUrl`을 보존하는지 기존 Route Handler 또는 목록 컴포넌트 테스트로 고정한다.
`PostData`를 사용하는 클라이언트 경계에는 필요한 문자열만 전달한다.

### 3. 최신 5개 콘텐츠 연동 검증

`fos-study`의 다음 글에 `thumbnail`이 있고 상대 파일이 실제로 존재하는지 확인한다.

- `java/spring/servlet-async-dispatch.md`
- `AI/RAG/evaluation-driven-context-provider.md`
- `AI/RAG/neo4j-graphrag/01-goal-and-baseline.md`
- `AI/RAG/neo4j-graphrag/02-property-graph-ontology-modeling.md`
- `AI/RAG/neo4j-graphrag/03-cypher-constraints-query-plans.md`

동기화 서비스 테스트 자료로 이 계약을 재현하고 전용 URL과 누락 대체 경로를 함께 검증한다.

### 4. 전체 검증과 완료 상태

검증이 모두 통과하면 `tasks/plan056-post-card-thumbnails/index.json`의 최상위 상태와 모든 phase 상태를 `completed`로 바꾼다.
각 phase 파일의 `Status`도 `completed`로 맞춘다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/posts/[...slug]/page.tsx` | 공유 이미지 우선순위 |
| `src/app/api/posts/latest/route.test.ts` | 최신 목록 응답 회귀 |
| `src/app/api/posts/popular/route.test.ts` | 인기 목록 응답 회귀 |
| `tasks/plan056-post-card-thumbnails/*` | 완료 상태 반영 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
# branch: plan056-post-card-thumbnails
pnpm type-check
pnpm lint
pnpm test
pnpm build
git diff --check
rg -n "thumbnail:" /private/tmp/fos-study-blog-thumbnail/java/spring/servlet-async-dispatch.md /private/tmp/fos-study-blog-thumbnail/AI/RAG/evaluation-driven-context-provider.md /private/tmp/fos-study-blog-thumbnail/AI/RAG/neo4j-graphrag/0{1,2,3}-*.md
```

기대값:

- 타입 검사, 린트, 전체 테스트, 빌드, diff 검사가 exit code 0이다.
- 다섯 글의 `thumbnail` 상대 경로가 모두 존재하는 이미지 파일을 가리킨다.
- 전용 URL이 있는 글과 없는 글의 메타데이터·카드 선택 경로가 테스트로 고정된다.
- task 상태가 모두 `completed`다.

## 의도 메모 (왜)

- 전용 이미지를 카드와 공유 화면에서 함께 사용해 한 글의 시각 정체성을 일치시킨다.
- 실제 콘텐츠 다섯 건과 누락 상태를 함께 검증해 새 글과 기존 글 경로를 동시에 고정한다.
- 전체 빌드는 마이그레이션 타입, 서버·클라이언트 경계, `next/og` 경로를 한 번에 확인한다.
