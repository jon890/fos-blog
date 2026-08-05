# Phase 01 — 글 카드 표시 변형과 로딩 상태

**Execution profile**: standard
**Status**: pending

---

## 목표

`PostCard`를 글 목록의 단일 표현 컴포넌트로 유지하면서 `row`, `grid`, `featured` 표시 변형을 명확히 구분한다.
일반 탐색 카드는 이미지를 먼저 인지하고 제목으로 클릭 여부를 판단할 수 있게 하며, 홈 대표 카드는 제목을 이미지 위에 표시한다.

**범위 외**: 페이지별 목록 연결, 무한 목록 배치, 데이터베이스·API·동기화 변경, 이미지 파일에 제목 합성, 문서 수정.

---

## 작업 항목 (4)

### 1. `PostCard` 표시 계약 확장

`src/components/PostCard.tsx`의 `variant` 타입을 `"row" | "grid" | "featured"`로 확장한다.
기본값은 `row`로 유지해 인기 글 목록의 기존 동작을 보존한다.

세 변형 모두 전체 카드를 하나의 `Link`로 제공하고 실제 글 제목 요소를 유지한다.
`PostThumbnail`의 `thumbnailUrl`, `category`, 빈 대체 텍스트, 오류 전환 책임은 바꾸지 않는다.

### 2. 썸네일 중심 `grid` 카드 정리

`grid` 변형은 16:9 이미지, 분류·날짜, 최대 두 줄 제목, 선택적 조회수만 표시한다.
`post.description`은 렌더링하지 않는다.

이미지 확대와 카드 이동 효과에는 기존 `motion-reduce` 예외를 유지한다.
키보드 초점이 카드 경계에서 분명하게 보이도록 프로젝트의 `focus-visible` 토큰을 적용한다.

### 3. 홈 전용 `featured` 카드 추가

`featured` 변형은 전체 폭 16:9 이미지 위에 아래쪽으로 짙어지는 덮개를 두고 분류·날짜·최대 세 줄 제목을 HTML 텍스트로 표시한다.
이미지 파일 자체에는 제목을 합성하지 않는다.

텍스트와 배경의 대비를 확보하고 긴 제목이 이미지 밖으로 넘치지 않게 한다.
조회수가 전달되면 보조 정보로 표시하되 제목보다 먼저 강조하지 않는다.

### 4. 변형별 로딩 상태와 회귀 테스트

`src/components/PostCardSkeleton.tsx`에 `variant?: "row" | "grid"`를 추가하고 기본값은 `row`로 유지한다.
격자형 로딩 상태는 16:9 이미지와 분류·제목 자리 표시자를 실제 `grid` 카드와 같은 순서로 둔다.

`src/components/PostCard.test.tsx`와 `src/components/PostCardSkeleton.test.tsx`를 추가한다.
DOM 테스트는 파일 첫 줄에 `// @vitest-environment jsdom`을 선언하고 `PostThumbnail`을 모의 구현한다.

다음을 고정한다.

- `row`는 소개글과 조회수를 유지한다.
- `grid`는 소개글을 렌더링하지 않고 제목을 최대 두 줄로 제한한다.
- `featured`는 제목을 이미지 덮개 안의 실제 제목 요소로 렌더링한다.
- 모든 변형이 같은 글 링크와 썸네일 입력을 사용한다.
- 로딩 상태의 기본값은 행형이며 `grid`를 명시하면 카드형 구조를 사용한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/PostCard.tsx` | `row`, `grid`, `featured` 표시 계약과 접근성 |
| `src/components/PostCard.test.tsx` | 표시 변형 회귀 테스트 신규 |
| `src/components/PostCardSkeleton.tsx` | 행형·격자형 로딩 상태 |
| `src/components/PostCardSkeleton.test.tsx` | 로딩 상태 회귀 테스트 신규 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/components/PostCard.test.tsx src/components/PostCardSkeleton.test.tsx
pnpm type-check
pnpm lint
git diff --check
```

기대값:

- 실행한 테스트, 타입 검사, 린트, diff 검사가 종료 코드 0이다.
- `PostCard` 이외의 컴포넌트가 대표 카드의 제목 덮개를 중복 구현하지 않는다.
- `PostThumbnail`의 전용 이미지와 대체 이미지 순서는 변경되지 않는다.

## 의도 메모 (왜)

- `origin/main`의 plan056이 이미 `PostThumbnail`과 `PostCard` 이미지 변형을 도입했으므로 새 이미지 컴포넌트를 만들지 않고 그 계약을 확장한다.
- 제목을 모든 썸네일 파일에 합성하면 긴 제목, 반응형 크기, 접근성 대응이 어려워져 HTML 텍스트로 유지한다.
- 대표 카드는 홈 최근 첫 글만 강조하는 표현이며 별도 글 도메인이 아니므로 새 컴포넌트보다 `PostCard` 변형이 적합하다.
