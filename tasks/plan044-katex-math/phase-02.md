# Phase 02 — sanitize allowlist 에 KaTeX 출력 element 추가

**Model**: sonnet
**Status**: pending

---

## 목표

plan029 가 도입한 rehype-sanitize 의 defaultSchema 확장에 KaTeX 가 출력하는 element / 클래스 / 속성을 추가한다. KaTeX 출력이 sanitize 단계에서 stripping 당하지 않도록 allowlist 보강. plan044 phase 01 의 unified-pipeline 변경 위에서 작업.

**전제 조건**: plan029 가 먼저 머지되어 unified-pipeline 에 `rehypeSanitize(schema)` 가 존재해야 함. plan029 가 아직 pending 이면 본 phase 는 plan029 머지 후 시작 (build-with-teams 자동 직렬 실행).

**범위 외**: KaTeX 통합 (phase 01). 회귀 테스트 (phase 03).

---

## 작업 항목 (3)

### 1. 기존 schema 구조 확인 (위치는 옵션 B 로 결정됨)

plan029 가 schema 를 `src/components/markdown/sanitize-schema.ts` 별도 파일에 정의 (옵션 B).
import 형식 (실제 파일 L3):
```ts
import { defaultSchema, type Options as Schema } from "rehype-sanitize";
```

기존 `attributes.span` 배열 구조 (실제 파일 L40-51):
```ts
span: [
  ...(defaultSchema.attributes?.span ?? []),
  "className",
  "style",
  "data-line",
  "data-highlighted-line",
  "data-highlighted-chars",
  "data-chars-id",
],
```

핵심 사실:
- `attributes.span` 배열에 이미 `"className"` 과 `"style"` 이 단순 문자열로 포함 — 모든 className / style 값이 통과 (shiki 토큰 색을 위해 필요했음)
- 따라서 **KaTeX 출력의 className (`katex`, `katex-display`, `mfrac`, `vlist`, …) 과 inline style (vertical-align, padding-left, …) 은 추가 entry 없이 이미 자동 통과**
- 실제 추가가 필요한 entry 는 KaTeX 가 fallback 영역에 쓰는 `"aria-hidden"` 뿐

### 2. `sanitize-schema.ts` 의 `attributes.span` 배열에 `aria-hidden` 추가

`src/components/markdown/sanitize-schema.ts` 의 기존 `span: [...]` 배열에 entry 1개만 append (다른 라인 변경 금지):

```diff
 span: [
   ...(defaultSchema.attributes?.span ?? []),
   "className",
   "style",
   "data-line",
   "data-highlighted-line",
   "data-highlighted-chars",
   "data-chars-id",
+  // KaTeX (plan044) — output:"html" 모드의 fallback 영역 aria-hidden 보존
+  "aria-hidden",
 ],
```

다른 키 (`tagNames`, `attributes.code` / `figure` / `figcaption` / `pre` / `div` / `h1..h6`) 는 변경하지 않는다. KaTeX html 출력은 `<span>` 만 사용.

핵심 결정:
- **regex 사용 안 함**: 기존 단순 `"className"` 이 이미 모든 className 을 통과시키므로 `["className", /^katex/]` 튜플 추가는 효과 없음 (OR 동작). regex 로 좁히려면 기존 `"className"` 제거 필요한데 그러면 shiki 토큰 className 도 같이 깨짐 — 위험. 그대로 둠
- **`style` 추가 안 함**: 기존에 이미 있음. KaTeX 의 vertical-align / padding 도 자동 통과
- **`<math>` / `<annotation>` 추가 안 함**: `output: "html"` 모드는 `<math>` 출력 없음. 향후 mathml 모드 도입 시 별도 plan
- **새 import / 새 변수 / 새 export 도입 안 함**: 기존 `export const sanitizeSchema: Schema` 를 그대로 유지. unified-pipeline.ts 의 `import { sanitizeSchema } from "./sanitize-schema"` 도 무변경

### 3. unified-pipeline.ts 의 rehypeSanitize 호출 순서 확인

`rehypeSanitize` 는 `rehypeKatex` *후* 에 와야 KaTeX 출력을 schema 가 처리:

```ts
.use(remarkMath)
.use(remarkRehype, { allowDangerousHtml: true })
.use(rehypeRaw)
.use(rehypeKatex, { throwOnError: false, output: "html" })   // 먼저 HTML 변환
.use(rehypeSlug)
.use(rehypePrettyCode, PRETTY_CODE_OPTIONS)
.use(rehypeSanitize, sanitizeSchema);                         // ← 마지막
```

순서 거꾸로 하면 KaTeX 가 출력한 HTML 이 sanitize 단계에서 strip 됨. plan029 가 sanitize 를 어디에 넣었는지 확인 — 일반적으로 **chain 마지막** 권장.

```bash
# cwd: <repo root>
awk '
  /rehypeKatex/ { rk=NR }
  /rehypeSanitize/ { rs=NR }
  END {
    if (rk < rs) print "순서 OK"
    else print "순서 오류: rehypeKatex=" rk " rehypeSanitize=" rs
  }
' src/components/markdown/unified-pipeline.ts
# 기대: "순서 OK"
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/markdown/sanitize-schema.ts` | `attributes.span` 배열에 `"aria-hidden"` entry 1개 추가 (그 외 라인 무변경) |

## 검증

```bash
# cwd: <repo root>

# 1. aria-hidden entry 가 span 배열에 추가
grep -nE "['\"]aria-hidden['\"]" src/components/markdown/sanitize-schema.ts
# 기대: 1건 이상

# 2. 기존 entry 보존 (className / style / data-line) — 깨졌으면 plan029 회귀
grep -cE "['\"]className['\"]" src/components/markdown/sanitize-schema.ts
# 기대: ≥ 3 (code / span / pre / div 등에서 className)
grep -cE "['\"]data-line['\"]" src/components/markdown/sanitize-schema.ts
# 기대: 1 (span 의 data-line)

# 3. import 경로 — `rehype-sanitize` 그대로 (hast-util-sanitize 도입 금지)
grep -nE "from ['\"]hast-util-sanitize['\"]" src/components/markdown/sanitize-schema.ts
# 기대: 0건 (없어야 함)
grep -nE "from ['\"]rehype-sanitize['\"]" src/components/markdown/sanitize-schema.ts
# 기대: 1건

# 4. 새 변수 / 새 export 도입 안 됨 — 단일 export 유지
grep -cE "^export " src/components/markdown/sanitize-schema.ts
# 기대: 1 (sanitizeSchema 만)

# 5. plugin 순서 — rehypeKatex 가 rehypeSanitize 전
awk '
  /rehypeKatex/ { rk=NR }
  /rehypeSanitize/ { rs=NR }
  END {
    if (rk && rs && rk < rs) print "order OK"
    else print "order 오류 또는 누락: rk=" rk " rs=" rs
  }
' src/components/markdown/unified-pipeline.ts
# 기대: "order OK"

# 6. lint/type-check
pnpm lint
pnpm type-check
```

## 의도 메모 (왜)

- **`aria-hidden` 만 추가**: 기존 `span` allowlist 의 `"className"` 과 `"style"` 이 단순 문자열이라 *모든* 값 통과 — KaTeX 의 다양한 className 과 inline style 은 추가 entry 없이 자동 통과. 실제 sanitize 단계에서 막히는 건 KaTeX html fallback 영역의 `aria-hidden` 속성뿐. 즉 phase-02 변경은 사실상 한 줄
- **regex 도입 회피**: `["className", /^katex/]` 튜플은 기존 `"className"` 과 OR 동작이라 효과 없음. 좁히려면 기존 entry 제거 필요한데 shiki 토큰 className (예: `text-blue`) 까지 같이 깨져 회귀 위험 → 그대로 둠
- **style 허용 trade-off (변경 없음, 기록만)**: 기존 plan029 가 shiki 색을 위해 이미 `"style"` 을 span allowlist 에 두었음. KaTeX 의 vertical-align / padding 도 같은 entry 로 통과. CSS injection 표면이 늘긴 하지만 rehypeKatex 가 생성한 style 만 통과 — 사용자 markdown 의 raw `style="…"` 은 rehypeRaw → rehypeSanitize 의 다른 경로로 처리됨
- **`output: "html"` 전제**: phase 01 의 결정과 일관. mathml 모드 도입 시 별도 plan 에서 `<math>` / `<annotation>` allowlist 추가
