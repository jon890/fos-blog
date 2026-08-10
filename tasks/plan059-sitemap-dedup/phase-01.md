# Phase 01 — 카테고리 URL 정규화와 중복 제거

**Execution profile**: standard
**Status**: pending

---

## 목표

카테고리 경로를 소문자로 정규화한 URL을 대표 형태로 삼는다.
`sitemap.xml`은 정규화된 URL만 중복 없이 내보내고, 카테고리 페이지의 canonical은 그 형태를 가리킨다.

GitHub 이슈 [#198](https://github.com/jon890/fos-blog/issues/198)을 해결한다.
결정 근거는 `docs/adr/035-category-url-canonical.md`에 있다.

### 지금 무엇이 잘못돼 있는가

`sitemap.xml`의 `/category` URL 72개 중 고유한 것은 52개다.

- **완전 동일 중복 20건** — `src/app/sitemap.ts:97`이 `categoryPages`와 `folderPages`를 중복 제거 없이 이어 붙인다.
  전자는 `categories` 테이블의 `slug`, 후자는 글 경로에서 계산한 폴더 경로를 쓰는데
  최상위 카테고리는 두 값이 항상 같다.
- **대소문자만 다른 중복 2쌍** — `/category/AI`와 `/category/ai`, `/category/AI/agent`와 `/category/ai/agent`.

canonical은 이미 있지만 `src/app/category/[...path]/page.tsx:93`이 요청 경로를 그대로 반사한다.
각 URL이 자기 자신을 대표로 선언해 중복을 하나로 모으는 기능이 없다.

**범위 외**: 글 URL(`/posts/...`)의 표기 변경, 얇은 카테고리를 sitemap에서 빼는 정책(이슈 #199), `/tag`와 `/series`의 canonical, 리디렉션 도입, 문서 수정(이미 완료).

---

## 작업 항목 (5)

### 1. 정규화 함수 추가

`src/lib/path-utils.ts`에 카테고리 경로 세그먼트를 정규 형태로 바꾸는 함수를 추가한다.

`sitemap.ts`와 `category/[...path]/page.tsx`가 **같은 함수를 쓰는 것이 이 phase의 핵심**이다.
각자 정규화하면 sitemap이 내보낸 URL과 canonical이 다시 어긋나 문제가 그대로 재발한다.
두 곳 모두 이미 이 파일에서 `computeFolderPaths`를 import 하므로 배치 위치가 자연스럽다.

함수는 세그먼트 배열을 받아 소문자로 바꾼 배열을 반환한다.
`encodeURIComponent` 적용은 호출부에 남긴다. 기존 두 호출부가 각자 인코딩하고 있어 책임을 옮기면 변경 범위가 커진다.

### 2. sitemap 중복 제거와 정규화

`src/app/sitemap.ts`를 고친다.

`categoryPages`와 `folderPages`를 만들 때 위 함수로 경로를 정규화한다.
최종 배열을 반환하기 전(`:97`) URL 기준으로 중복을 제거한다.
`Map`에 URL을 키로 넣는 방식이면 순서가 보존되고 먼저 들어온 항목이 남는다.

중복 제거는 카테고리 항목에만 적용하지 말고 최종 배열 전체에 건다.
`staticPages`와 `postPages`에는 지금 중복이 없지만, 앞으로 항목이 늘 때 같은 문제가 재발하지 않게 하려는 것이다.

`lastModified`, `changeFrequency`, `priority` 값은 바꾸지 않는다.

### 3. canonical을 정규 형태로 고정

`src/app/category/[...path]/page.tsx`의 `generateMetadata`를 고친다.

`canonicalUrl`을 만들 때 요청에서 받은 `pathSegments`를 그대로 쓰지 말고 정규화 함수를 통과시킨다.
페이지 조회와 화면 렌더에 쓰는 `folderPath`는 **바꾸지 않는다** — 조회는 대소문자를 구분하지 않으므로
요청 값 그대로 두어야 화면에 표시되는 폴더명이 저장소 원본 표기를 유지한다.
정규화는 canonical URL 생성에만 적용한다.

### 4. 경로 유틸리티 회귀 테스트 추가

`src/lib/path-utils.test.ts`를 새로 만든다. 이 파일은 아직 없다.

다음을 고정한다.

- 정규화 함수가 대문자 세그먼트를 소문자로 바꾼다.
- 이미 소문자인 세그먼트는 그대로 둔다.
- 여러 단계 경로(`["AI", "RAG"]`)의 모든 세그먼트를 처리한다.
- 빈 배열을 넣으면 빈 배열이 나온다.
- 기존 `computeFolderPaths` 동작이 바뀌지 않는다.

### 5. sitemap 조립 결과 회귀 테스트 추가

`src/app/sitemap.test.ts`를 새로 만든다.
Repository는 기존 Route Handler 테스트와 같은 방식으로 `vi.mock`해 실제 DB에 연결하지 않는다.

다음을 고정한다.

- 카테고리와 폴더 경로가 같은 URL을 만들면 결과에 한 번만 나온다.
- 대소문자만 다른 카테고리 경로는 소문자 URL 하나로 합쳐진다.
- 정적 페이지와 글 페이지가 누락되지 않는다.
- `lastModified`, `changeFrequency`, `priority` 값은 기존과 같다.
- 카테고리와 글이 모두 없어도 정적 페이지만 반환한다.
- Repository 조회가 실패하면 기존 catch 동작대로 정적 페이지만 반환한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/path-utils.ts` | 카테고리 경로 정규화 함수 추가 |
| `src/lib/path-utils.test.ts` | 신규. 정규화와 기존 함수 회귀 |
| `src/app/sitemap.ts` | 정규화 적용과 URL 기준 중복 제거 |
| `src/app/sitemap.test.ts` | 신규. sitemap 조립 결과와 실패 폴백 회귀 |
| `src/app/category/[...path]/page.tsx` | canonical을 정규 형태로 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/worktrees/fos-blog/plan059-sitemap-dedup-2
pnpm test src/lib/path-utils.test.ts
pnpm test src/app/sitemap.test.ts
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

기대값: 위 명령이 모두 종료 코드 0이다.

```bash
# cwd: /Users/nhn/personal/fos-blog/worktrees/fos-blog/plan059-sitemap-dedup-2
rg -n "pathSegments" "src/app/category/[...path]/page.tsx"
```

기대값: canonical 생성 줄에서 정규화 함수를 거치지 않고 `pathSegments`를 직접 쓰는 곳이 없다.
화면 렌더와 조회에 쓰는 `pathSegments`는 그대로 남아 있어야 한다.

배포 후 다음으로 실제 해소를 확인한다. 배포 전에는 실행할 수 없다.

```bash
# cwd: 무관. 배포된 사이트를 조회하므로 어느 디렉터리에서 실행해도 된다
curl -sS https://blog.fosworld.co.kr/sitemap.xml \
  | grep -oE '<loc>[^<]+</loc>' | sed 's|</\?loc>||g' \
  | awk '{print tolower($0)}' | sort | uniq -d
```

기대값: 출력이 0줄이다.

검증이 모두 통과하면 `tasks/plan059-sitemap-dedup/index.json`의 최상위 `status`와 phase의 `status`를 `completed`로 변경한다.

## 의도 메모 (왜)

- 한 phase로 묶은 이유는 세 파일의 변경이 하나의 결정에서 나오기 때문이다.
  정규화 함수만 추가하고 sitemap을 안 고치면 아무 효과가 없고,
  sitemap만 고치고 canonical을 두면 외부 링크로 유입된 다른 표기가 다시 색인된다.
  한 번에 검증해야 중복 0을 확인할 수 있다.
- 리디렉션 대신 canonical을 고른 이유는 라우트가 대소문자를 구분하지 않아
  정규 형태를 판별하려면 요청마다 비교와 분기가 필요하기 때문이다. 근거는 ADR-035에 있다.
- 글 URL을 그대로 둔 이유는 이미 색인된 300여 개 주소가 한꺼번에 바뀌는 것을 피하기 위해서다.
- 중복 제거를 카테고리가 아니라 최종 배열에 건 이유는 같은 실수가 다른 항목에서 반복되지 않게 하려는 것이다.
