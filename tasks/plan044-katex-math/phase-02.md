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

### 1. plan029 의 sanitize schema 위치 파악

plan029 가 schema 를 어디에 정의했는지 확인:
```bash
# cwd: <repo root>
grep -rnE "defaultSchema|sanitizeSchema|rehypeSanitize" src/components/markdown/
# 기대: schema 정의 파일 1개 식별 (unified-pipeline.ts 또는 별도 파일)
```

plan029 phase-01.md 의 schema 위치 관례:
- 옵션 A: `unified-pipeline.ts` 안 inline schema 객체
- 옵션 B: `src/components/markdown/sanitize-schema.ts` 별도 파일

발견된 위치에서 작업.

### 2. KaTeX 가 출력하는 element / 클래스 / 속성 allowlist 확장

`output: "html"` (phase 01 결정) 모드의 KaTeX 출력 구조:
- 루트 wrapper: `<span class="katex">` (inline) 또는 `<span class="katex-display"><span class="katex">...</span></span>` (block)
- 내부 element: `<span>` 만 사용 (output html 모드). class 들이 핵심 — 수많은 katex 클래스
- 속성: `class`, `style` (inline 위치 조정), `aria-hidden`, `data-*`

allowlist 확장 — `defaultSchema` 수정 (deepClone 후 mutate 권장):

```ts
import { defaultSchema } from "hast-util-sanitize";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // KaTeX 는 span 만 사용 — defaultSchema 에 이미 포함이지만 명시
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^katex/],          // 'katex' 또는 'katex-*' prefix 클래스
      "style",                          // KaTeX 의 inline style (margin / padding / vertical-align)
      "aria-hidden",
    ],
  },
};
```

핵심 결정:
- **`className` regex `/^katex/`**: KaTeX 가 출력하는 클래스가 매우 많음 (`katex`, `katex-html`, `katex-mathml`, `base`, `strut`, `mfrac`, `vlist`, ...). 모두 명시는 불가능 — `katex` prefix 만 매치하면 다 통과. 단 `output: "html"` 라 `katex-mathml` 안 나옴 (안전)
- **`style` 허용**: KaTeX 의 글자 위치 (vertical-align, padding-left) 가 inline style 에 들어감. 제거 시 수식 깨짐. XSS 위험: `style="background:url(...)"` 같은 inject — 단 KaTeX 출력은 안전한 패턴만 (margin/padding/vertical-align/height). 사용자 input 이 직접 들어가지 않음
- **`aria-hidden`**: KaTeX 가 mathml fallback 영역에 추가하지만 output=html 모드는 거의 안 나옴. 안전망 차원

대안 검토 — `<math>` / `<annotation>` 허용 (이슈 #130 본문 언급):
- `output: "html"` 모드에서는 `<math>` 출력 안 됨. 별도 추가 불필요
- 향후 `output: "mathml"` 또는 dual mode 도입 시 추가 필요 — 본 plan scope 외

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
| `src/components/markdown/unified-pipeline.ts` 또는 `sanitize-schema.ts` | KaTeX 출력 element / className regex / style attribute allowlist |

## 검증

```bash
# cwd: <repo root>

# 1. KaTeX className regex 추가
grep -nE "katex" src/components/markdown/*.ts | grep -v "test" | head -5
# 기대: rehypeKatex import + sanitize schema 의 katex regex 모두 출현

# 2. style attribute 허용
grep -nE "['\"]style['\"]" src/components/markdown/*.ts
# 기대: 1건 이상 — span 의 attribute 목록에 style

# 3. order 검증
awk '
  /rehypeKatex/ { rk=NR }
  /rehypeSanitize/ { rs=NR }
  END {
    if (rk && rs && rk < rs) print "order OK"
    else print "order 오류 또는 누락: rk=" rk " rs=" rs
  }
' src/components/markdown/unified-pipeline.ts
# 기대: "order OK"

# 4. lint/type-check
pnpm lint
pnpm type-check
```

## 의도 메모 (왜)

- **className regex `/^katex/`**: KaTeX 의 클래스 수십 개를 모두 명시는 유지보수 0. prefix 매치가 KaTeX 출력 100% 커버 + 다른 라이브러리 충돌 거의 0 (`katex` prefix 가 일반적이지 않음)
- **style 허용 trade-off**: XSS 표면 ↑ 지만 KaTeX 출력의 style 은 라이브러리가 통제 — 사용자 input 이 style 에 직접 들어가지 않음. 마크다운 소스의 raw HTML 은 rehypeRaw 단계에서 들어오지만 그 이후 sanitize 가 잡음 (정상). KaTeX style 은 rehypeKatex 단계의 *생성물* 이라 안전
- **`output: "html"` 전제**: phase 01 의 결정과 일관. mathml 모드 도입 시 별도 plan 에서 `<math>` / `<annotation>` allowlist 추가
