# Phase 02 — 카드 이미지와 단계적 대체

**Execution profile**: standard
**Status**: completed

---

## 목표

글 카드에 16:9 대표 이미지를 추가하고 전용 이미지가 없거나 깨졌을 때 카테고리별 생성 이미지와 사이트 기본 이미지로 전환한다.

**범위 외**: 앞표지 파싱, DB 마이그레이션, 글 상세 공유 메타데이터, AI 이미지 생성 호출.

---

## 작업 항목 (4)

### 1. 카테고리별 생성 이미지 Route Handler

`src/app/api/og/thumbnails/[category]/route.tsx`를 추가한다.
DB를 조회하지 않고 `getCategoryHex()`와 안정적인 category hash를 사용해 카테고리마다 구분되는 기하학 패턴을 `ImageResponse`로 만든다.

이미지는 16:9이며 큰 형태와 강한 초점 하나를 사용한다.
카테고리 이름은 보조 표식으로만 쓰고 시각 패턴이 주 요소가 되게 한다.
Node.js runtime과 하루 이상 재검증 주기를 선언한다.

### 2. `PostThumbnail` 오류 전환 경계

`src/components/PostThumbnail.tsx`를 클라이언트 컴포넌트로 추가한다.
입력은 `thumbnailUrl?: string | null`, `category: string`, `sizes: string`, 선택적 `className`으로 제한한다.

이미지 순서는 전용 URL, `/api/og/thumbnails/<encoded-category>`, `/og-default.png`다.
`onError`에서 다음 경로로 한 번씩만 이동하고 마지막 실패에서는 이미지를 숨겨 무한 반복을 막는다.
장식 이미지로 빈 `alt`를 사용한다.

### 3. `PostCard` 행·격자 변형 적용

격자 변형은 카드 상단 전체 폭에 16:9 이미지를 두고 기존 본문 영역을 유지한다.
행 변형은 왼쪽에 16:9 이미지 창을 두며 작은 화면과 `@lg` 컨테이너에서 크기를 조절한다.
이미지 위에 제목이나 설명을 겹치지 않는다.

### 4. 로딩 스켈레톤과 컴포넌트 테스트

`PostCardSkeleton`의 열과 16:9 이미지 자리 표시자를 실제 행 카드와 맞춘다.
DOM 테스트는 파일 상단에 `// @vitest-environment jsdom`을 선언한다.

다음을 검증한다.

- 전용 URL이 첫 이미지다.
- URL이 없으면 카테고리별 생성 이미지로 시작한다.
- 오류가 두 번 나면 사이트 기본 이미지로 이동한다.
- 마지막 오류에서 이미지 요소를 숨긴다.
- 행과 격자 변형 모두 이미지 영역과 제목 링크를 유지한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/api/og/thumbnails/[category]/route.tsx` | 카테고리별 생성 이미지 |
| `src/components/PostThumbnail.tsx` | 단계적 이미지 전환 |
| `src/components/PostThumbnail.test.tsx` | 이미지 순서와 오류 회귀 |
| `src/components/PostCard.tsx` | 행·격자 이미지 레이아웃 |
| `src/components/PostCardSkeleton.tsx` | 이미지 자리 표시자 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
# branch: plan056-post-card-thumbnails
pnpm test src/components/PostThumbnail.test.tsx
pnpm type-check
pnpm lint
git diff --check
```

기대값:

- 컴포넌트 테스트, 타입 검사, 린트, diff 검사가 exit code 0이다.
- `PostThumbnail` 외의 카드 경로에 새 `use client` 선언이 없다.
- 이미지가 제목·설명 텍스트와 겹치지 않는다.

## 의도 메모 (왜)

- 약 300개 기존 글은 카테고리별 생성 이미지로 즉시 시각성을 얻는다.
- 생성형 AI는 작성 시점의 전용 이미지에만 사용하고 페이지 요청 경로에서는 호출하지 않는다.
- 작은 클라이언트 경계만 두어 서버 컴포넌트와 목록 응답 직렬화 이점을 유지한다.
