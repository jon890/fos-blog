# Phase 01 — 의존성 추가 + unified-pipeline 통합 + globals.css 토큰 정의

**Model**: sonnet
**Status**: pending

---

## 목표

`remark-math` + `rehype-katex` + `katex` 의존성 추가. `src/components/markdown/unified-pipeline.ts` 의 processor chain 에 두 plugin 을 정확한 순서로 삽입. `src/app/globals.css` 에 KaTeX CSS import + 다크모드 `color: inherit` override.

**범위 외**: sanitize allowlist 확장 (phase 02 — plan029 결과 위에서 작업). 회귀 테스트 (phase 03).

---

## 작업 항목 (4)

### 1. 의존성 추가

```bash
# cwd: <repo root>
pnpm add remark-math rehype-katex katex
```

설치 결과:
- `package.json` dependencies 에 3개 추가
- `pnpm-lock.yaml` 갱신 — 같은 commit 에 함께 포함 (CLAUDE.md "Git & PR Conventions" lockfile 규칙)

`@types/katex` 는 별도 설치 불필요 — katex 4+ 는 types 내장.

### 2. `src/components/markdown/unified-pipeline.ts` — plugin 통합

현재 chain (`buildProcessor()` 내부, L16-23 — plan029 머지 직후 상태):
```ts
unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(rehypePrettyCode, PRETTY_CODE_OPTIONS)
  .use(rehypeSanitize, sanitizeSchema); // ← chain 말미 (plan029)
```

변경 후 (rehypeSanitize 라인은 **반드시 유지** — 삭제 시 plan029 회귀):
```ts
unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)                                              // ← 추가 (remark 단계)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex, { throwOnError: false, output: "html" })    // ← 추가 (rehype 단계, sanitize 전)
  .use(rehypeSlug)
  .use(rehypePrettyCode, PRETTY_CODE_OPTIONS)
  .use(rehypeSanitize, sanitizeSchema);                         // ← 그대로 유지 (chain 말미)
```

상단 import 추가:
```ts
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
```

핵심 결정:
- **순서**: `remarkMath` 는 `remarkRehype` *전* (remark 단계에서 math 노드 인식). `rehypeKatex` 는 `remarkRehype` *후* + `rehypeSlug` *전* (rehype 단계에서 HTML 변환). pretty-code 와 충돌 가능성 0 (code block vs math 블록은 별도 node type)
- **`throwOnError: false`**: invalid LaTeX (예: `$\frac{1}$`) 발생 시 빨간 텍스트로 표시. 빌드 / 페이지 렌더 안 깨짐
- **`output: "html"`**: MathML 대신 HTML span 출력. 브라우저 호환성 ↑ (MathML 은 Safari/Chrome 차이). 단 sanitize allowlist 가 katex 의 HTML span class 들을 알아야 함 (phase 02)

### 3. `src/app/globals.css` — KaTeX CSS import + 다크모드 override

파일 상단 (다른 `@import` 와 같은 위치) 에:
```css
@import "katex/dist/katex.min.css";
```

`@import` 위치는 기존 import 들과 같은 블록 — Tailwind `@source` directives 위 또는 아래 (CSS 순서 영향 없음, 단 일관성).

다크모드 color override (파일 어디든 prose 관련 섹션 근처):
```css
/* KaTeX 수식 색을 본문 텍스트 색으로 inherit (라이트/다크 양쪽 자연) — plan044 */
.prose .katex,
.prose .katex * {
  color: inherit;
}
```

`.prose .katex` 만 잡으면 katex root 만 inherit. `.katex *` 까지 잡아야 내부 모든 span (수식 부호 / 분자 / 분모 / 첨자) 이 본문 색 따라감. KaTeX 기본 검정 → 라이트모드 OK, 다크모드 자연.

### 4. `src/app/globals.css` 의 `@source` directive 확인

CLAUDE.md "Conventions" — `@source` 가 katex.css 파일을 스캔해 invalid 클래스 잡지 않도록 주의. KaTeX 의 클래스 패턴 (`text-[var(...)]` 같은 Tailwind arbitrary 가 아님) 은 단순 CSS 클래스 — Tailwind content scan 영향 없음.

검증:
```bash
# cwd: <repo root>
# globals.css 의 @source 가 node_modules 를 포함하지 않는지
grep -nE "@source.*node_modules" src/app/globals.css
# 기대: 0건 — KaTeX 의 클래스가 invalid CSS 후보로 추출되지 않도록
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `package.json` | dependencies 에 remark-math / rehype-katex / katex 추가 |
| `pnpm-lock.yaml` | 위 변경의 lockfile 갱신 (same commit) |
| `src/components/markdown/unified-pipeline.ts` | remarkMath + rehypeKatex 2개 plugin 삽입 |
| `src/app/globals.css` | katex.min.css import + `.prose .katex` 색 inherit override |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan044-katex-math-impl (build-with-teams 자동 생성)

# 1. 의존성 설치 확인
node -e 'console.log(require("./package.json").dependencies["remark-math"], require("./package.json").dependencies["rehype-katex"], require("./package.json").dependencies["katex"])'
# 기대: 3개 버전 모두 출력

# 2. unified-pipeline 에 plugin 삽입
grep -cE "remarkMath|rehypeKatex" src/components/markdown/unified-pipeline.ts
# 기대: ≥ 4 (import 2개 + .use() 2개)

# 3. plugin 순서 — remarkMath < remarkRehype < rehypeKatex < rehypeSanitize
awk '
  /remarkRehype/ { rr=NR }
  /remarkMath/ { rm=NR }
  /rehypeKatex/ { rk=NR }
  /rehypeSanitize/ { rs=NR }
  END {
    if (rm < rr && rk > rr && rs > rk) print "순서 OK"
    else print "순서 오류: remarkMath=" rm " remarkRehype=" rr " rehypeKatex=" rk " rehypeSanitize=" rs
  }
' src/components/markdown/unified-pipeline.ts
# 기대: "순서 OK"

# 3-b. plan029 회귀 방지 — rehypeSanitize 라인이 chain 에 그대로 보존
grep -cE "rehypeSanitize.*sanitizeSchema" src/components/markdown/unified-pipeline.ts
# 기대: 1 (plan029 의 한 줄이 그대로 유지)

# 4. globals.css 의 import + color override
grep -cE "katex/dist/katex(\.min)?\.css" src/app/globals.css
# 기대: 1
grep -cE "\.prose \.katex" src/app/globals.css
# 기대: ≥ 1

# 5. throwOnError: false 명시
grep -nE "throwOnError.*false" src/components/markdown/unified-pipeline.ts
# 기대: 1건 출현

# 6. 빌드/lint
pnpm lint
pnpm type-check
```

수동 smoke (`pnpm dev`):
- 수식이 있는 글 (생성해서 테스트): 인라인 `$x^2$` / 블록 `$$\int_0^1 x\,dx$$` 양쪽 렌더 확인
- 다크/라이트 모드 토글 — 수식 색이 본문 텍스트 색 따라가는지

## 의도 메모 (왜)

- **plugin 순서**: remarkMath 는 remark 단계의 math node 마커. rehypeKatex 는 그 마커를 HTML 로 변환. 순서 거꾸로 하면 rehypeKatex 가 math node 못 찾아 invisible fail
- **`output: "html"` (MathML 아님)**: MathML 은 Safari 와 Chrome 의 렌더 차이가 큼. HTML span 은 모든 모던 브라우저 일관. trade-off: sanitize allowlist 가 katex 의 HTML 클래스 / data-* 모두 알아야 함 (phase 02)
- **`color: inherit` 강제**: KaTeX default 가 검정 — 라이트 모드 OK 지만 다크 모드에서 까만 배경에 까만 수식. inherit 으로 본문 텍스트 색 (`var(--color-text-primary)` 또는 prose default) 따라감 — 단 1줄 CSS 로 양쪽 모드 모두 자연
- **`throwOnError: false`**: 마크다운 소스 소유자가 사용자라 (자기 글) typo 가능. throw 면 빌드 실패 — 운영 사고. 빨간 텍스트로 즉시 인지 + 페이지 정상 렌더
