# Phase 02 — parseFrontMatter boolean coercion + generateMetadata robots 매핑

**Model**: sonnet
**Goal**: 글 단위 색인 차단 인프라 도입. frontmatter `index: false` 가 있는 글은 `robots: { index: false, follow: true }` 메타를 출력.

## Context (자기완결)

폴더 단위 차단은 `src/infra/github/file-filter.ts` 의 `EXCLUDED_FILENAMES` 가 sync 자체를 막음.
글 단위 차단은 sync 는 하되 메타 한 줄로 검색엔진에만 비노출 — 두 정책 도메인 분리.

현재 적용 글은 0건. 향후 비공개 전환 필요 시 frontmatter 한 줄로 처리 가능하도록 인프라만 도입.

**critic v1 지적 반영**: `parseFrontMatter` (markdown.ts:19-63) 는 line 56 `frontMatter[key] = value` 로 **모든 값을 string 으로 저장**한다.
즉 frontmatter 에 `index: false` 라고 적어도 `frontMatter.index` 는 string `"false"` 가 되어 `=== false` (boolean 비교) 가 영원히 false.
해결: parser 에 `"true"` / `"false"` → boolean coercion 을 추가하고, `generateMetadata` 에서는 `frontMatter.index === false` 한 줄 인라인 비교 (헬퍼 추출 금지 — 단일 사용처).

**기존 참조**:

- `src/lib/markdown.ts` 의 `FrontMatter` 인터페이스 + `parseFrontMatter`
- `src/app/posts/[...slug]/page.tsx` 의 `generateMetadata`

## 작업 항목

### 1. `parseFrontMatter` boolean coercion 추가

`src/lib/markdown.ts` 의 line 49-57 영역. 배열 처리 분기 다음, default 할당 직전에 boolean 분기 추가:

```diff
       // Handle arrays (simple case)
       if (value.startsWith("[") && value.endsWith("]")) {
         const arrayContent = value.slice(1, -1);
         frontMatter[key] = arrayContent
           .split(",")
           .map((item) => item.trim().replace(/['"]/g, ""));
+      } else if (value === "true" || value === "false") {
+        frontMatter[key] = value === "true";
       } else {
         frontMatter[key] = value;
       }
```

`seriesOrder` 같은 numeric string 은 영향 없음 (SyncService 가 `Number()` 로 정규화). quoted `"true"` / `"false"` 는 line 42-47 의 quote 제거 단계에서 이미 unquote 된 후 boolean 으로 변환되지만 frontmatter 에서 quoted boolean 의미 무 — 안전.

### 2. `FrontMatter.index?: boolean` 타입 추가

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
+  /** false 일 때 글 페이지에 `robots: { index: false, follow: true }` 적용 — 검색엔진 색인 제외 (plan048). parseFrontMatter 의 boolean coercion 으로 frontmatter `index: false` 가 boolean false 로 변환됨. 폴더 단위 차단은 src/infra/github/file-filter.ts. */
+  index?: boolean;
   [key: string]: unknown;
 }
```

### 3. `generateMetadata` robots 매핑 (인라인)

`src/app/posts/[...slug]/page.tsx` 의 `generateMetadata` 안. `parseFrontMatter` import 가 이미 있는지 확인:

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan048
grep -n "parseFrontMatter" src/app/posts/\[...slug\]/page.tsx
```

없으면 import 추가. metadata 객체 반환 부분에 spread 분기 1줄 추가:

```ts
const { frontMatter } = parseFrontMatter(data.content);

return {
  title,
  description,
  alternates: { canonical: postUrl },
  ...(frontMatter.index === false && { robots: { index: false, follow: true } }),
  openGraph: { /* ... */ },
  twitter: { /* ... */ },
};
```

`extractTitle` 이 내부에서 다시 `parseFrontMatter` 를 호출하지만 (line 66-72 영역) 비용 무시 — 일관성 차원의 정리는 별 plan 후보.

### 4. 단위 테스트 — parser coercion

`src/lib/markdown.test.ts` 가 이미 있으면 추가, 없으면 신설:

```ts
describe("parseFrontMatter — boolean coercion", () => {
  it("index: false 를 boolean false 로 변환", () => {
    const { frontMatter } = parseFrontMatter("---\nindex: false\n---\n본문");
    expect(frontMatter.index).toBe(false);
  });
  it("index: true 를 boolean true 로 변환", () => {
    const { frontMatter } = parseFrontMatter("---\nindex: true\n---\n본문");
    expect(frontMatter.index).toBe(true);
  });
  it("index 미지정 시 undefined", () => {
    const { frontMatter } = parseFrontMatter("---\ntitle: foo\n---\n본문");
    expect(frontMatter.index).toBeUndefined();
  });
  it("seriesOrder string 은 boolean coercion 영향 없음", () => {
    const { frontMatter } = parseFrontMatter("---\nseriesOrder: 2\n---\n본문");
    expect(frontMatter.seriesOrder).toBe("2");
  });
});
```

### 5. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan048
pnpm lint
pnpm type-check
pnpm test --run -- markdown

# 타입 확인
grep -n "index\?: boolean" src/lib/markdown.ts
# 기대: 1건

# 메타 매핑 확인 (헬퍼 없이 인라인)
grep -n "frontMatter.index === false" src/app/posts/\[...slug\]/page.tsx
# 기대: 1건
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/lib/markdown.ts` | 수정 (FrontMatter.index + parseFrontMatter boolean coercion) |
| `src/lib/markdown.test.ts` | 수정 또는 신설 (parser coercion 테스트) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (generateMetadata 인라인 매핑) |

## Out of Scope

- frontmatter 의 다른 SEO 필드 (sitemap 제외 / OG image 커스텀) — 인프라 도입 1차는 boolean noindex 만
- 실제 어떤 글에 `index: false` 적용할지 — 본 phase 는 인프라만, 적용은 fos-study repo 측 글 수정
- robots.txt Disallow — frontmatter 단위 정책과 별개. 본 plan scope 외
- shouldNoindex 헬퍼 추출 — 단일 사용처라 인라인 (CLAUDE.md "단순함 우선")

## Risks

| 리스크 | 완화 |
|---|---|
| boolean coercion 이 기존 frontmatter 의 string `"true"` / `"false"` 를 의도치 않게 변환 | 현재 FrontMatter 인터페이스의 알려진 필드 (title/date/description/tags/series/seriesOrder) 중 boolean 의미를 string 으로 보존하는 곳 없음. 신규 `index` 외 영향 없음 |
| extractTitle 내부 parseFrontMatter 중복 호출 | 동기 + 짧은 정규식 — 비용 무시. 일관성 차원의 정리는 별 plan 후보 |
| YAML 파서 교체 시 (gray-matter 등) 본 coercion 무용 | 본 plan 은 현 단순 파서 기준. 파서 교체는 별 plan + 본 변경은 그 시점에 재검토 |
