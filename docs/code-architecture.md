# 코드 아키텍처

**갱신일:** 2026-07-30
**관련 문서:** [PRD](./prd.md) · [흐름](./flow.md) · [데이터 스키마](./data-schema.md) · [ADR](./adr/README.md)

## 시스템 경계

fos-blog는 GitHub의 마크다운 콘텐츠를 MySQL로 동기화하고 Next.js App Router로 제공한다.
운영 환경은 홈서버의 Docker 컨테이너이며 Next.js standalone 출력을 사용한다.

```text
app
  ↓
services
  ↓
infra/db · infra/github
  ↑
lib
```

- `app`은 라우팅, 메타데이터, 화면 조합을 담당한다.
- `app`은 목표 구조에서 `infra`를 직접 가져오지 않고 `services`를 거친다.
- `services`는 조회와 여러 Repository 조합, 외부 부수 효과가 있는 흐름을 담당한다.
- `infra`는 MySQL과 GitHub API를 캡슐화한다.
- `lib`는 마크다운 전처리, 경로, 로깅과 범용 계산을 제공한다.
- `components`는 Repository를 생성하거나 DB에 직접 접근하지 않는다.

### 현재 코드의 레이어 이탈

현재 여러 페이지와 Route Handler가 `getRepositories()`를 직접 가져온다.
홈, 카테고리, 글·태그·시리즈 목록과 댓글·검색·방문 API가 대표적이다.

이는 실제 구현을 숨기지 않기 위해 기록한 코드 부채이며 새 코드의 허용 규칙이 아니다.
새 흐름은 서비스 경계를 사용하고, 기존 직접 접근은 동작을 고정하는 테스트와 함께 별도 리팩터링으로 옮긴다.

## 주요 디렉터리

| 경로 | 책임 |
| --- | --- |
| `src/app/` | 페이지, Route Handler, 메타데이터, OG 이미지 |
| `src/components/` | 재사용 UI와 클라이언트 상호작용 |
| `src/services/` | 동기화, 용어집, RSS, 통계 같은 도메인 흐름 |
| `src/infra/db/` | Drizzle 스키마, DB 연결, Repository |
| `src/infra/github/` | GitHub API와 콘텐츠 파일 처리 |
| `src/lib/` | 공용 유틸리티와 마크다운 기반 기능 |
| `src/middleware/` | 방문 기록과 요청 제한 |
| `src/proxy.ts` | 요청 제한과 방문 기록 조합 |
| `scripts/` | 마이그레이션 등 독립 실행 작업 |
| `drizzle/` | 배포 환경에서 적용할 마이그레이션 |

## Repository 경계

`getRepositories()`는 React `cache()`로 요청 안에서 Repository 인스턴스를 재사용한다.
서비스가 Repository를 구성할 때 사용하며, 현재는 위에 기록한 레이어 이탈 코드에서도 직접 호출한다.

| Repository | 주요 책임 |
| --- | --- |
| `PostRepository` | 글, 검색, 태그, 시리즈, 관련 글 |
| `CategoryRepository` | 카테고리 집계와 탐색 |
| `FolderRepository` | 폴더와 README 메타데이터 |
| `CommentRepository` | 댓글 생성, 수정, 삭제 |
| `VisitRepository` | 방문 기록과 인기 글 통계 |
| `SyncLogRepository` | GitHub 동기화 결과 기록 |
| `GlossaryRepository` | 용어 정의와 언급 역참조 |

DB 구조와 제약의 단일 소스는 `src/infra/db/schema/`다.
사람이 읽는 스키마 설명은 [data-schema.md](./data-schema.md)가 담당한다.

## 콘텐츠 동기화

```text
/api/sync
  → syncGitHubToDatabase
  → SyncService
      → GitHub 변경 비교
      → GlossarySyncService
      → PostSyncService
      → MetadataSyncService
      → SyncLogRepository
```

- `/api/sync`는 `SYNC_API_KEY` Bearer 인증을 확인한다.
- `SyncService`는 GitHub HEAD와 마지막 성공 커밋을 비교해 전체 또는 증분 동기화를 선택한다.
- 글 변경이 없어도 제목, README 메타데이터와 용어집 역참조를 다시 계산할 수 있다.
- 삭제된 글은 `posts.is_active`를 이용해 비활성화한다.
- 같은 GitHub 상태를 반복 처리해도 글이 중복되거나 유실되지 않아야 한다.

## 페이지 조회

현재 페이지는 Repository 직접 호출과 서비스 위임이 혼재한다.
목표 구조와 현재 이탈은 “시스템 경계”에 기록한다.
페이지별 화면과 상태는 `docs/pages/` 문서가 담당한다.

| 라우트 | 책임 문서 |
| --- | --- |
| `/` | `docs/pages/home.md` |
| `/about` | `docs/pages/about.md` |
| `/categories` | `docs/pages/categories.md` |
| `/category/[...path]` | `docs/pages/category-detail.md` |
| `/contact` | `docs/pages/contact.md` |
| `/glossary` | `docs/pages/glossary.md` |
| `/posts/[...slug]` | `docs/pages/post-detail.md` |
| `/posts/latest` | `docs/pages/posts-latest.md` |
| `/posts/popular` | `docs/pages/posts-popular.md` |
| `/privacy` | `docs/pages/privacy.md` |
| `/series` | `docs/pages/series-index.md` |
| `/series/[name]` | `docs/pages/series-detail.md` |
| `/tag/[name]` | `docs/pages/tag.md` |

각 페이지는 자체 `revalidate`와 오류·빈 상태를 선언한다.
실제 값은 해당 `page.tsx`와 페이지 문서를 함께 확인한다.

## API 경계

| 경로 | 책임 |
| --- | --- |
| `/api/sync` | GitHub 콘텐츠 동기화 |
| `/api/search` | 글 검색 |
| `/api/posts/latest` | 최신 글 추가 조회 |
| `/api/posts/popular` | 인기 글 추가 조회 |
| `/api/comments` | 댓글 목록과 생성 |
| `/api/comments/[id]` | 댓글 수정과 삭제 |
| `/api/visit` | 방문 기록 |
| `/api/og/category/[...path]` | 카테고리 OG 이미지 |
| `/api/og/posts/[...slug]` | 글 OG 이미지 |

요청과 응답 형식은 Route Handler의 타입과 테스트를 단일 소스로 삼는다.
모든 API가 Bearer 인증을 사용한다고 가정하지 않는다.

## 마크다운 렌더링

```text
마크다운 원문
  → unified remark 파서
  → GFM · 수식 · raw HTML
  → KaTeX · slug · Shiki 코드 강조
  → sanitize
  → 용어집 HAST 변환
  → JSX 컴포넌트 매핑
```

- `src/components/markdown/`의 서버 모듈은 각 파일에서 `import "server-only"`를 선언한다.
- sanitize는 스크립트, 이벤트 속성과 위험한 URL을 제거한다.
- `CodeCard`, Mermaid, 용어 도움말과 이미지 확대는 컴포넌트 매핑으로 연결한다.
- 클라이언트 상태가 필요한 기능만 client island로 분리한다.

## 횡단 관심사

### 로깅과 오류

- 서버 코드는 `@/lib/logger`의 구조화 로거를 사용한다.
- 알 수 없는 오류는 `Error`로 정규화해 기록한다.
- 본문 조회 실패와 관련 글 같은 보조 기능 실패를 구분한다.

### 요청 보호

- `src/proxy.ts`는 요청 제한을 먼저 적용하고 허용된 요청의 방문 기록을 비동기로 남긴다.
- 댓글 비밀번호는 평문으로 저장하지 않는다.
- 외부 HTML은 마크다운 sanitize 경계를 통과해야 한다.

### 캐시와 갱신

- 페이지와 RSS는 각 파일의 `revalidate` 값을 사용한다.
- 동기화 후 콘텐츠 반영 지연은 해당 경로의 갱신 주기 안에서 허용한다.
- 운영 배포에 Vercel 전용 기능을 전제하지 않는다.

## 변경 규칙

- 새 페이지를 추가하면 대응하는 `docs/pages/*.md`를 함께 만든다.
- 새 페이지와 Route Handler는 Repository를 직접 가져오지 않고 서비스 경계를 사용한다.
- 스키마 변경은 Drizzle 마이그레이션과 `docs/data-schema.md`를 함께 갱신한다.
- 코드만 보고 알 수 없는 장기 결정은 ADR에 이유와 기각한 대안을 남긴다.
- 구현 함수와 응답 필드의 상세 목록을 이 문서에 복사하지 않는다.
