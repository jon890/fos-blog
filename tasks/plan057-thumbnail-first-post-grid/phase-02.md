# Phase 02 — 글 목록 화면 통합과 검증

**Execution profile**: standard
**Status**: pending

---

## 목표

Phase 01의 카드 변형을 홈, 최신, 카테고리, 태그, 시리즈, 관련 글에 연결하고 인기 글의 고밀도 행 목록은 유지한다.
모든 목록에서 초기 항목과 추가 조회 항목이 같은 표현 규칙을 사용하도록 통합한다.

**범위 외**: 검색 결과 변경, 저장·API 응답 계약 변경, 새 분석 이벤트, 썸네일 생성 방식 변경, 문서 수정.

**선행 조건**: `src/components/PostCard.tsx`가 `variant="featured"`를 지원하고 `src/components/PostCardSkeleton.tsx`가 `variant="grid"`를 지원해야 한다.
없으면 Phase 01의 커밋이 현재 브랜치에 포함됐는지 확인하고 `PHASE_BLOCKED: Phase 01 산출물 누락`을 출력한 뒤 종료한다.

---

## 작업 항목 (5)

### 1. 홈 최근 글의 대표 카드와 격자 배치

`src/app/page.tsx`에서 인기 글은 명시적으로 `variant="row"`를 사용한다.
최근 글 첫 항목은 `variant="featured"`로 전체 폭에 표시하고 나머지는 모바일 1열, 태블릿 2열, 넓은 화면 3열의 `variant="grid"` 배열로 표시한다.

최근 글이 한 건일 때는 대표 카드만 렌더링한다.
글이 없을 때의 기존 빈 상태와 `SectionCTAButton` 동작은 유지한다.

### 2. 조회 방식에 맞춘 무한 목록 표현

`src/components/PostsInfiniteList.tsx`에서 `mode="latest"`는 모바일 1열, 태블릿 2열, 넓은 화면 3열 배열과 `variant="grid"` 카드를 사용한다.
`mode="popular"`는 기존 행 목록과 `variant="row"` 카드를 사용한다.

추가 조회로 받은 항목도 현재 `mode`의 같은 카드 변형으로 누적한다.
로딩 중에는 최신 모드에 `PostCardSkeleton variant="grid"`, 인기 모드에 기본 행형 로딩 상태를 각각 세 개 표시한다.
기존 `IntersectionObserver`, 더 보기, 재시도, 완료 안내, 중복 요청 방지 흐름은 바꾸지 않는다.

### 3. 분류·시리즈·관련 글의 격자 통일

다음 화면에서 `PostCard variant="grid"`를 사용한다.
목록은 모바일 1열, 태블릿 2열, 넓은 화면 3열을 기본으로 하되 관련 글의 최대 너비와 글 개수에 맞는 기존 간격은 유지한다.

- `src/app/category/[...path]/page.tsx`
- `src/app/tag/[name]/page.tsx`
- `src/app/series/[name]/page.tsx`
- `src/components/RelatedPosts.tsx`

카테고리 페이지는 `mergedPosts`의 중복 제거 결과와 다중 카테고리 정보를 그대로 `PostCard`에 전달한다.
시리즈의 순서 번호와 `<ol>`, 관련 글의 빈 배열 미렌더 계약은 유지한다.

### 4. 카테고리 전용 행 컴포넌트 제거

카테고리 연결이 끝나면 아래 파일과 잔재를 제거한다.

- `src/components/PostListRow.tsx`
- `src/components/PostListRow.test.tsx`
- `src/app/globals.css`의 `.post-list-row` 전용 규칙
- 카테고리 페이지에서 더는 쓰지 않는 `CSSProperties`, `getCategoryColor`, 행 번호 계산

새 목록 컴포넌트나 새 전역 선택자를 추가하지 않는다.

### 5. 목록 모드 회귀와 반응형 동작 검증

`src/components/PostsInfiniteList.test.tsx`를 추가한다.
DOM 테스트는 파일 첫 줄에 `// @vitest-environment jsdom`을 선언하고 `IntersectionObserver`, `fetch`, 카드·로딩 상태를 필요한 경계에서 모의 구현한다.

다음을 검증한다.

- 최신 초기 항목과 추가 조회 항목은 모두 `grid`다.
- 인기 초기 항목과 추가 조회 항목은 모두 `row`다.
- 모드별 로딩 상태가 올바른 변형을 사용한다.
- 요청 실패 뒤 재시도가 가능하고 완료 상태 문구가 유지된다.

로컬 서버를 실행한 뒤 Orca 브라우저로 `/`, `/posts/latest`, `/posts/popular`, 실제 데이터가 있는 카테고리·태그·시리즈·글 상세의 관련 글을 확인한다.
390×844, 1024×768, 1440×900 화면에서 가로 넘침이 없고, 카드 열 전환, 제목 줄 제한, 키보드 초점, 모션 감소, 이미지 오류 대체가 계획 문서와 일치하는지 기록한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/page.tsx` | 최근 대표·격자와 인기 행 목록 |
| `src/components/PostsInfiniteList.tsx` | 최신·인기 모드별 카드와 로딩 배열 |
| `src/components/PostsInfiniteList.test.tsx` | 초기·추가 조회·오류 회귀 테스트 신규 |
| `src/app/category/[...path]/page.tsx` | 카테고리 글 격자 |
| `src/app/tag/[name]/page.tsx` | 넓은 화면 3열 격자 |
| `src/app/series/[name]/page.tsx` | 순서 보존 3열 격자 |
| `src/components/RelatedPosts.tsx` | 명시적 격자 카드 |
| `src/components/PostListRow.tsx` | 삭제 |
| `src/components/PostListRow.test.tsx` | 삭제 |
| `src/app/globals.css` | 행 전용 선택자 삭제 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/components/PostCard.test.tsx src/components/PostsInfiniteList.test.tsx src/components/PostThumbnail.test.tsx
pnpm type-check
pnpm lint
pnpm test
pnpm build
git diff --check
rg -n "PostListRow|post-list-row|post-list-rows" src docs
```

기대값:

- 테스트, 타입 검사, 린트, 빌드, diff 검사가 종료 코드 0이다.
- 마지막 `rg`는 출력이 없고 종료 코드 1이다.
- Orca 브라우저 검증 대상 화면에서 콘솔 오류, 깨진 이미지, 가로 넘침이 없다.
- 대표 카드 제목과 일반 카드 제목은 이미지 실패 여부와 관계없이 접근 가능한 HTML 텍스트로 남는다.

검증이 모두 통과하면 `tasks/plan057-thumbnail-first-post-grid/index.json`의 최상위 `status`와 두 phase의 `status`를 `completed`로 변경한다.

## 의도 메모 (왜)

- 최근 글과 탐색 목록은 발견성을 높이는 격자 표현이 목적이고, 인기 글은 조회수 순서를 비교하는 밀도가 더 중요해 행 표현을 유지한다.
- 카테고리 전용 `PostListRow`를 병행하면 같은 글 목록의 정보 우선순위와 접근성 수정이 두 곳으로 갈라지므로 `PostCard`로 통합한다.
- 저장 계약과 API 응답은 이미 카드에 필요한 값을 제공하므로 화면 계층만 수정한다.
- 화면 계층의 하나의 탐색 목표이며 카드 계약과 화면 연결을 한 PR에서 함께 검토해야 완성되므로 별도 plan으로 나누지 않는다.
