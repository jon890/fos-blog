# Phase 01 — 썸네일 메타데이터 동기화와 저장

**Execution profile**: standard
**Status**: pending

---

## 목표

`fos-study` 마크다운의 `thumbnail` 앞표지 값을 안전한 GitHub raw URL로 정규화해 글 목록 조회에 저장한다.

**범위 외**: 카드 레이아웃, 이미지 오류 전환, 카테고리별 생성 이미지, 기존 글 이미지 일괄 생성.

---

## 작업 항목 (4)

### 1. 마크다운과 GitHub 이미지 경로 계약

`src/lib/markdown.ts`의 `FrontMatter`에 `thumbnail?: string`을 추가한다.
`src/infra/github/image-rewrite.ts`에 마크다운 파일 기준 상대 이미지 경로를 정규화하고 raw 절대 URL로 만드는 공개 함수를 추가한다.

허용 확장자는 `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`다.
`http:`, `https:`, 저장소 루트를 벗어나는 `..`, 빈 값, fragment와 query가 붙은 값은 `null`로 처리한다.
URL의 각 경로 구간은 `encodeURIComponent`로 인코딩한다.

### 2. `posts.thumbnail_url` 스키마와 마이그레이션

`src/infra/db/schema/posts.ts`에 nullable `varchar(2048)` 컬럼 `thumbnailUrl`을 추가한다.
`pnpm db:generate`로 다음 번호의 `drizzle/*.sql`과 `drizzle/meta/*`를 생성하고 SQL을 직접 편집하지 않는다.

### 3. 동기화 저장

`PostSyncService.upsert()`가 원본 앞표지의 `thumbnail`을 읽고 정규화한 URL을 create와 update 양쪽에 전달한다.
누락하거나 무효인 값은 `null`이며 글 저장은 계속한다.
본문 이미지 재작성과 앞표지 파싱의 순서가 서로 영향을 주지 않게 원본 `fileData.content`에서 앞표지를 읽는다.

### 4. 조회 타입과 Repository 선택 목록

`PostData`에 `thumbnailUrl?: string | null`을 추가한다.
`PostCard`로 전달되는 최근, 인기, 최신, 카테고리, 태그, 시리즈, 관련 글 조회와 `getPost()`가 `thumbnailUrl`을 선택하도록 갱신한다.
검색 결과처럼 현재 `PostCard`가 사용하지 않는 계약은 불필요하게 확장하지 않는다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/markdown.ts` | `thumbnail` 앞표지 타입 |
| `src/infra/github/image-rewrite.ts` | 상대 경로 검증과 raw URL 변환 |
| `src/infra/db/schema/posts.ts` | `thumbnail_url` 컬럼 |
| `drizzle/*.sql` | 생성된 마이그레이션 |
| `src/services/PostSyncService.ts` | create·update 저장 |
| `src/infra/db/types.ts` | `PostData.thumbnailUrl` |
| `src/infra/db/repositories/PostRepository.ts` | 카드와 상세 조회 선택 목록 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
# branch: plan056-post-card-thumbnails
pnpm test src/lib/sync-github.test.ts src/services/PostSyncService.test.ts src/infra/db/repositories/PostRepository.test.ts
pnpm type-check
git diff --check
rg -n "thumbnailUrl|thumbnail_url" src drizzle
```

기대값:

- 테스트, 타입 검사, diff 검사가 exit code 0이다.
- 유효한 상대 경로는 인코딩된 raw URL이 되고 잘못된 경로는 `null`이다.
- 생성·수정 동기화와 모든 `PostCard` 조회 경로가 `thumbnailUrl`을 전달한다.

## 의도 메모 (왜)

- 목록 요청마다 긴 마크다운 본문을 읽고 파싱하지 않도록 파생 URL을 동기화 시점에 저장한다.
- 잘못된 선택 메타데이터 때문에 본문 게시가 중단되지 않게 nullable 계약을 사용한다.
- 저장소나 브랜치 설정이 바뀌면 전체 동기화로 URL을 다시 계산한다.
