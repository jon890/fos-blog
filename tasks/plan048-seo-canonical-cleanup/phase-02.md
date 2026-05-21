# Phase 02 — FrontMatter.index + generateMetadata robots 매핑

**Model**: sonnet
**Goal**: 글 단위 색인 차단 인프라 도입. frontmatter `index: false` 가 있는 글은 `robots: { index: false, follow: true }` 메타를 출력.

## Context (자기완결)

폴더 단위 차단은 `src/infra/github/file-filter.ts` 의 `EXCLUDED_FILENAMES` 가 sync 자체를 막음.
글 단위 차단은 sync 는 하되 메타 한 줄로 검색엔진에만 비노출 — 두 정책 도메인 분리.

현재 적용 글은 0건. 향후 비공개 전환 필요 시 frontmatter 한 줄로 처리 가능하도록 인프라만 도입.

**기존 참조**:

- `src/lib/markdown.ts` 의 `FrontMatter` 인터페이스
- `src/app/posts/[...slug]/page.tsx` 의 `generateMetadata`

## 작업 항목

### 1. `FrontMatter` 타입 확장

`src/lib/markdown.ts`:

```diff
 export interface FrontMatter {
   title?: string;
   date?: string;
   description?: string;
   tags?: string[];
   series?: string;
   /** YAML 파서가 `seriesOrder: 2` 를 number 로, `seriesOrder: "2"` 를 string 으로 반환할 수 있어 둘 다 허용. ... */
   seriesOrder?: number | string;
+  /** false 일 때 글 페이지에 `robots: { index: false, follow: true }` 적용 — 검색엔진 색인 제외 (plan048). 폴더 단위 차단은 src/infra/github/file-filter.ts 의 EXCLUDED_FILENAMES 가 sync 자체를 막음. */
+  index?: boolean;
   [key: string]: unknown;
 }
```

### 2. `generateMetadata` 매핑

`src/app/posts/[...slug]/page.tsx` 의 `generateMetadata` 함수 안에서 frontmatter 파싱 후 robots 메타 분기:

```ts
const { frontMatter } = parseFrontMatter(data.content);
const noindex = frontMatter.index === false;

return {
  title,
  description,
  alternates: { canonical: postUrl },
  ...(noindex && { robots: { index: false, follow: true } }),
  openGraph: { /* ... */ },
  twitter: { /* ... */ },
};
```

`parseFrontMatter` import 는 이미 line 6 영역에 있는지 확인 — 없으면 추가:

```bash
# cwd: /Users/nhn/personal/fos-blog
grep -n "parseFrontMatter" src/app/posts/\[...slug\]/page.tsx
# 기대: import 1줄 + 사용 N줄
```

`generateMetadata` 안에서 `data.content` 는 이미 fetch 되어 있음 (line 50 의 `extractTitle(data.content)` 사용). `parseFrontMatter(data.content)` 추가 호출은 동기 작업이라 비용 무시 가능.

### 3. 단위 테스트

`src/app/posts/[...slug]/page.test.ts` 또는 기존 테스트 파일에 추가. 테스트 환경이 없으면 (server component 라 직접 테스트 어려움) — skip 하고 phase-03 통합 검증으로 대체.

대안: 새 헬퍼 함수 추출 — `src/lib/markdown.ts` 에 `shouldNoindex(frontMatter): boolean` 추가하고 단위 테스트.

```ts
// markdown.ts
export function shouldNoindex(frontMatter: FrontMatter): boolean {
  return frontMatter.index === false;
}

// markdown.test.ts (또는 신설)
describe("shouldNoindex", () => {
  it("index: false 일 때 true", () => {
    expect(shouldNoindex({ index: false })).toBe(true);
  });
  it("index 미지정 시 false", () => {
    expect(shouldNoindex({})).toBe(false);
  });
  it("index: true 일 때 false", () => {
    expect(shouldNoindex({ index: true })).toBe(false);
  });
  it("index: 'false' (string) 일 때 false — YAML 파서가 boolean 으로 처리하지 못한 경우 보수적 처리", () => {
    expect(shouldNoindex({ index: "false" as unknown as boolean })).toBe(false);
  });
});
```

`generateMetadata` 에서 `shouldNoindex(frontMatter)` 호출.

### 4. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run -- markdown

# 타입 확인
grep -n "index\?: boolean" src/lib/markdown.ts
# 기대: 1건

# 메타 매핑 확인
grep -n "shouldNoindex\|robots:" src/app/posts/\[...slug\]/page.tsx
# 기대: shouldNoindex 호출 1건 + robots 분기 1건
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/lib/markdown.ts` | 수정 (FrontMatter.index + shouldNoindex 헬퍼) |
| `src/lib/markdown.test.ts` | 수정 또는 신설 (shouldNoindex 케이스) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (generateMetadata 매핑) |

## Out of Scope

- frontmatter 의 다른 SEO 필드 (예: `index: true` 강제 활성화 / sitemap 제외 / OG image 커스텀) — 인프라 도입 1차는 boolean noindex 만
- 실제 어떤 글에 `index: false` 적용할지 — 본 phase 는 인프라만, 적용은 fos-study repo 측 글 수정
- robots.txt Disallow — frontmatter 단위 정책과 별개. 본 plan scope 외

## Risks

| 리스크 | 완화 |
|---|---|
| YAML 파서가 `index: false` 를 string `"false"` 로 반환 가능 | `frontMatter.index === false` (boolean 비교) 로 보수적 처리. string fallback 은 적용 안 됨 (위양성 회피). 운영 시 적용 글 작성자가 `false` (불린) 로 정확히 작성하도록 docs |
| 향후 다른 frontmatter SEO 필드 추가 시 `generateMetadata` 분기 폭증 | 본 phase 는 `index` 만. 추가 필드 시 `buildSeoMeta(frontMatter)` 헬퍼 추출 고려 (별 plan) |
| `shouldNoindex` 가 다른 곳에서도 필요한지 (예: sitemap 제외) | sitemap.ts 는 `getAllPostsForSitemap` 호출. frontmatter 까지 보지 않음. noindex 글이 sitemap 에 남아도 robots 메타가 우선 — Google 색인 안 함. sitemap 제외는 별 plan 후보 |
