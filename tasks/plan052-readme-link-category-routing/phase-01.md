# Phase 01 — resolveMarkdownLink README → /category 라우팅 + 테스트

**Model**: sonnet
**Status**: pending

---

## 목표

마크다운 본문에 직접 작성된 `README.md` 링크가 블로그에서 전부 "글을 찾을 수 없습니다"(soft 404) 로 깨지는 문제를 고친다 (이슈 #178).

원인: `src/lib/resolve-markdown-link.ts` 의 `resolveMarkdownLink` 가 모든 `.md` 링크를 `/posts/<경로>` 로 변환한다.
그런데 `README.md` 는 글로 게시되지 않고 `/category/<폴더>` 카테고리 페이지로만 렌더된다 (`src/app/category/[...path]/page.tsx` 가 README 본문을 `ReadmeFrame` 으로 렌더). 따라서 README 를 `/posts/.../README.md` 로 가리키는 본문 링크는 대상 글이 없어 404 가 된다.

수정: 링크 경로의 마지막 세그먼트가 `README`(`.md`/`.mdx`, 대소문자 무시) 이면 그 세그먼트를 떼고 `/category/<폴더>` 로 보낸다.
실측 기준 fos-study 의 본문 README 링크 33건이 모두 복구된다.

**범위 외**:
- fos-study 콘텐츠 33곳 링크 직접 수정 (렌더러 한 곳 수정이 영구적 — 이슈에서 기각).
- 자동 생성 사이드바·카테고리 네비게이션 링크 (이미 `/category/...` 로 정상).
- `components.tsx` 호출부·DB·API 변경 (불필요 — 함수 내부만 변경).

---

## 작업 항목 (3)

### 1. `src/lib/resolve-markdown-link.ts` — README 분기 + 절대/상대경로 통합

현재 함수는 절대경로(`/` 시작)를 `/posts${linkPath}` 로 바로 붙이고, 상대경로만 세그먼트로 해석한다.
절대·상대 양쪽을 **공통 세그먼트 계산**으로 합친 뒤, 마지막 세그먼트가 README 면 `/category` 로, 아니면 기존대로 `/posts` 로 보낸다.

변경 후 함수 전체 (이 형태로 교체):

```ts
/**
 * 마크다운의 상대/절대경로 .md 링크를 블로그 URL로 변환
 *
 * 라우팅 규약:
 * - 일반 글: /java/post.md → /posts/java/post.md (.md 유지)
 * - README: README 는 글이 아니라 /category 폴더 페이지로 렌더되므로
 *   (src/app/category/[...path]/page.tsx) 마지막 세그먼트를 떼고 /category/<폴더> 로 보낸다.
 *   본문에 직접 쓴 README 링크가 /posts/.../README.md 로 가서 404 나는 것을 막는다 (이슈 #178).
 * - 최상위 README (폴더가 빈 문자열) → /categories (카테고리 목록). /category/ 빈 경로는 404 이므로 방어.
 * - 앵커(#...)는 그대로 보존.
 *
 * @param href 마크다운 링크의 href 값
 * @param basePath 현재 파일의 경로 (예: "java/spring-batch/README.md")
 */
export function resolveMarkdownLink(href: string, basePath: string): string {
  const hashIdx = href.indexOf("#");
  const fragment = hashIdx !== -1 ? href.slice(hashIdx) : "";
  const linkPath = hashIdx !== -1 ? href.slice(0, hashIdx) : href;

  let resolved: string[];
  if (linkPath.startsWith("/")) {
    // 절대경로 (repo root 기준)
    resolved = linkPath.split("/").filter(Boolean);
  } else {
    // 상대경로: basePath 의 디렉토리 기준으로 해석
    resolved = basePath.split("/").slice(0, -1);
    for (const seg of linkPath.split("/")) {
      if (seg === ".") continue;
      else if (seg === "..") resolved.pop();
      else if (seg !== "") resolved.push(seg);
    }
  }

  const last = resolved[resolved.length - 1];
  if (last && /^README(\.mdx?)?$/i.test(last)) {
    const folder = resolved.slice(0, -1).join("/");
    // 최상위 README → 폴더 없음 → 카테고리 목록으로 방어 (/category/ 빈 경로는 404)
    return folder ? `/category/${folder}${fragment}` : `/categories${fragment}`;
  }

  return `/posts/${resolved.join("/")}${fragment}`;
}
```

핵심 변경점:
- 절대경로도 세그먼트 배열로 분해 (`filter(Boolean)` 으로 빈 세그먼트 제거) → README 체크를 절대·상대 공통으로 적용.
- 상대경로 루프에 `seg !== ""` 추가 — `foo//bar` 같은 연속 슬래시 방어 (기존엔 빈 세그먼트가 push 됨).
- README 정규식 `/^README(\.mdx?)?$/i` — `.md`/`.mdx`, 대소문자 무시. `README-notes.md` 처럼 README 로 시작만 하는 파일명은 매치되지 않아야 한다 (`$` 앵커).

### 2. `src/lib/resolve-markdown-link.test.ts` — 테스트 케이스 추가 (꼼꼼히)

**기존 11개 테스트는 그대로 통과 유지** (일반 글 링크 회귀 방지). 아래 신규 describe 블록들을 추가한다.

```ts
describe("README → /category 라우팅 (이슈 #178)", () => {
  it("상대경로 하위 폴더 README → /category", () => {
    expect(
      resolveMarkdownLink("./mysql/README.md", "database/README.md")
    ).toBe("/category/database/mysql");
  });

  it("상대경로 상위 이동 README → /category (일반 글 → README 케이스)", () => {
    expect(
      resolveMarkdownLink("../java/opentelemetry/README.md", "architecture/observability-basics.md")
    ).toBe("/category/java/opentelemetry");
  });

  it("README → 다른 폴더 README 인덱스 링크 (README → README 케이스)", () => {
    expect(
      resolveMarkdownLink("../RAG/README.md", "AI/agent/multi-turn-memory-healthcare-agent.md")
    ).toBe("/category/AI/RAG");
  });

  it("같은 디렉토리 ./README.md → 자기 폴더 카테고리", () => {
    expect(
      resolveMarkdownLink("./README.md", "database/mysql/README.md")
    ).toBe("/category/database/mysql");
  });

  it("절대경로 README → /category", () => {
    expect(
      resolveMarkdownLink("/database/mysql/README.md", "database/README.md")
    ).toBe("/category/database/mysql");
  });

  it("README 링크에 앵커가 있으면 보존한다", () => {
    expect(
      resolveMarkdownLink("./mysql/README.md#설치", "database/README.md")
    ).toBe("/category/database/mysql#설치");
  });

  it(".mdx README 도 /category 로 보낸다", () => {
    expect(
      resolveMarkdownLink("./guide/README.mdx", "docs/README.md")
    ).toBe("/category/docs/guide");
  });

  it("소문자 readme.md 도 대소문자 무시하고 /category 로 보낸다", () => {
    expect(
      resolveMarkdownLink("./mysql/readme.md", "database/README.md")
    ).toBe("/category/database/mysql");
  });
});

describe("README 방어 — 잘못 매치되면 안 되는 케이스", () => {
  it("README 로 시작만 하는 파일명은 글로 취급 (/posts 유지)", () => {
    expect(
      resolveMarkdownLink("./README-notes.md", "database/README.md")
    ).toBe("/posts/database/README-notes.md");
  });

  it("README 가 파일명이 아닌 폴더명 중간 세그먼트면 글로 취급", () => {
    // 마지막 세그먼트(post.md)가 README 가 아니므로 /posts
    expect(
      resolveMarkdownLink("/java/post.md", "java/README.md")
    ).toBe("/posts/java/post.md");
  });
});

describe("최상위 README 방어 (폴더 빈 문자열)", () => {
  it("절대경로 /README.md → /categories (목록)", () => {
    expect(
      resolveMarkdownLink("/README.md", "java/README.md")
    ).toBe("/categories");
  });

  it("최상위에서 ./README.md → /categories", () => {
    expect(
      resolveMarkdownLink("./README.md", "README.md")
    ).toBe("/categories");
  });

  it("최상위 README 링크에 앵커가 있으면 /categories 에 보존", () => {
    expect(
      resolveMarkdownLink("/README.md#intro", "java/README.md")
    ).toBe("/categories#intro");
  });
});
```

테스트 설계 의도:
- **회귀 방지**: `README-notes.md`(README 로 시작만), 마지막 세그먼트가 글인 절대경로 → 기존 `/posts` 유지 검증. 정규식 `$` 앵커가 제대로 동작하는지 확인.
- **3종 README 케이스 모두 커버**: 일반 글 → README, README → README, 같은 폴더 ./README.
- **확장자·대소문자**: `.md` / `.mdx` / 소문자 `readme`.
- **앵커 보존**: README·루트 방어 양쪽에서 fragment 유지.
- **루트 방어**: folder 빈 문자열 시 `/categories` 로 fallback.

### 3. 검증

아래 검증 절을 모두 통과시킨다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/resolve-markdown-link.ts` | 수정 — 절대/상대 통합 + README 분기 + 루트 방어 + 주석 |
| `src/lib/resolve-markdown-link.test.ts` | 수정 — README/방어/루트 테스트 describe 3개 추가 |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run src/lib/resolve-markdown-link.test.ts

# 기존 11개 + 신규 13개 = 24개 전부 통과 확인 (개수는 추가한 it 수에 따라 조정)
# README 분기가 함수에 실제로 들어갔는지 확인
grep -nE "/category/|README\(\\\\\\.mdx" src/lib/resolve-markdown-link.ts

# 호출부는 변경되지 않았는지 확인 (함수 내부 변경만)
grep -n "resolveMarkdownLink(href, basePath)" src/components/markdown/components.tsx
```

기대값:
- `pnpm lint` / `pnpm type-check` exit 0.
- 테스트 파일 전체 통과 (기존 11 + 신규 13).
- `grep` 으로 `/category/` 분기가 함수에 존재.

수동 smoke (`pnpm dev`, 선택 — DB 연결 시):
- `/category/database` 진입 → 하위 README 인덱스 링크 클릭 → 카테고리 페이지로 이동 (404 없음).
- 일반 글 본문의 README 링크 클릭 → 카테고리로 이동.

## 의도 메모 (왜)

- **렌더러 한 곳 수정 채택**: fos-study 콘텐츠 33곳 링크를 직접 고치면 README 링크 추가 시마다 재발한다. 변환 함수 한 곳을 고치는 편이 영구적 (이슈 #178 "대안 (채택 안 함)").
- **절대/상대 통합**: README 체크를 양쪽에 중복 작성하지 않으려고 세그먼트 계산을 공통화. 절대경로도 `filter(Boolean)` 후 동일 로직.
- **루트 README → /categories 방어**: `/category/` 빈 경로는 `[...path]` 가 최소 1세그먼트를 요구해 404. 실측 33건엔 루트 README 링크가 없지만 향후 추가 시 깨지지 않게 fallback. (사용자 결정 — 방어 코드 추가, ADR 기록은 생략하고 함수 주석으로 의도 보존.)
- **README 정규식 `$` 앵커**: `README-notes.md` 같은 글이 카테고리로 잘못 라우팅되지 않도록 정확히 README 파일명만 매치.

## 완료 처리

이 phase 완료 시 `tasks/plan052-readme-link-category-routing/index.json` 의 `status` 와 phase 1 의 `status` 를 `"completed"` 로 갱신한다.
