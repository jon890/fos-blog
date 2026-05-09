# Phase 01 — 모바일 가독성 3개 fix 일괄 + 회귀 테스트

**Model**: sonnet
**Goal**: 모바일 (390px) 글 상세 페이지의 본문 inline code / 테이블 / 코드 블록 가독성 회복.

## Context (자기완결)

agent-browser (Chrome for Testing) iPhone 14 (390×844, dpr=3) emulation 으로 https://blog.fosworld.co.kr/posts/database/mysql/mysql-index-explain-commerce-api.md 확인 시 **3개 가독성 회귀** 발견:

### 문제 1 — inline code token 단위 wrap 안 됨 (issue #136)

prose 내 `:not(pre) > code` 의 computed style:
- `word-break: break-all`
- `overflow-wrap: anywhere`

두 속성이 동시 적용되면 모든 글자 사이에서 wrap 가능 → token 보존이 깨짐.

실측 사례:
- `EXPLAIN` → `EXPL` `AIN` 두 줄
- `created_at` → `c` `reated_at`
- `database/mysql/mysql-innodb-index.md` 도 글자 단위 깨짐

원인: plan018 (mobile horizontal scroll guard) 에서 페이지 가로 overflow 만 막으려고 prose 전체에 너무 공격적인 `word-break: break-all` 적용.

### 문제 2 — 테이블 가로 스크롤 wrapper 부재 (issue #137)

GFM 테이블이 `width: 100%` 로 viewport 강제 fit 됨. 좁은 cell 폭에 안의 inline code 가 더 심하게 깨짐.

실측 사례 — EXPLAIN 핵심 필드 표:
- 첫 컬럼 `필드` width 67px → `type`, `key`, `key_len` 등이 한 글자씩 세로로 깨짐
- 둘째 컬럼 `무엇을 보는가` 274px → `const, eq_ref, ref, range...` 부자연스럽게 끊김

가로 스크롤 wrapper (`overflow-x: auto`) 도 없어 손가락 가로 스크롤 불가.

### 문제 3 — 코드 블록 overflow-x visible 회귀 (issue #138)

`pre` 의 computed style:
- `overflow: visible`, `overflow-x: visible`
- `scrollWidth: 501px`, `clientWidth: 340px`

긴 SQL/명령 라인이 viewport 밖으로 잘려 보이고 가로 스크롤도 불가.

원인 추정: plan012 (code block redesign) 의 `.code-card-body pre` selector 가 어디선가 회귀됐거나 prose `pre` selector specificity 충돌.

## 작업 항목

### 1. `src/app/globals.css` — inline code wrap 정책 분리 (#136)

현재 prose 전반에 적용된 word-break 룰을 inline code 한정으로 완화. 새 룰을 prose 영역 끝에 추가 (specificity 우선):

```css
.prose :not(pre) > code,
.prose :not(pre) code {
  /* token 단위 wrap 보존 (한국어 어절 + 영문 식별자) */
  word-break: keep-all;
  /* 너무 긴 token (200+ chars hash 등) 만 끊김 허용 — 안전망 */
  overflow-wrap: anywhere;
}
```

**중요**:
- `word-break: keep-all` 만 두면 viewport 보다 긴 단일 token 이 horizontal overflow 유발 가능 → `overflow-wrap: anywhere` 가 fallback (정상 token 길이 10~30 chars 는 wrap 안 됨, 200 chars 같은 극단만 발동)
- pre 안 코드 (`pre code`) 는 영향 받지 않게 selector 명확히 — 위 selector 의 `:not(pre)` parent 검사

선택자 점검:
```bash
# 어떤 selector 가 inline code 에 word-break: break-all 을 적용 중인지 grep
grep -nE "word-break|overflow-wrap" src/app/globals.css
```

기존 `word-break: break-all` 룰을 prose 전반에서 제거하고 inline code / table cell 등 좁은 영역만 명시적으로 적용. 또는 위 새 룰이 specificity 로 우선 적용되면 기존 룰 유지 가능 (적용 후 verify).

### 2. `src/components/markdown/components.tsx` — 테이블 wrapper override (#137)

`createMarkdownComponents` 의 `table` 키에 div wrapper override 추가:

```tsx
table: ({ children, ...props }: ComponentProps<'table'>) => (
  <div className="prose-table-wrapper my-6 -mx-4 overflow-x-auto md:mx-0">
    <table className="min-w-[32rem] mx-4 md:mx-0" {...props}>
      {children}
    </table>
  </div>
),
```

설명:
- `-mx-4` 로 모바일에서 prose padding 을 넘어 wrapper 가 viewport 끝까지 확장 → 가로 스크롤 영역 넓힘
- `min-width: 32rem (512px)` 로 cell 폭 강제 압축 방지 → 가로 스크롤 가능
- `md:mx-0` / `md:` 로 데스크톱은 기존 동작 유지 (overflow 안 발생)
- `prose-table-wrapper` className 으로 globals.css 추가 polish 가능 (지금은 OOS)

`createMarkdownComponents` 위치 확인:
```bash
grep -n "table:" src/components/markdown/components.tsx
```

기존 table override 가 이미 있으면 그 자리에 추가, 없으면 신규 키 추가.

### 3. `src/app/globals.css` — 코드 블록 overflow-x 명시 (#138)

prose 코드 블록 + plan012 `.code-card` wrapper 양쪽 selector 모두 가로 스크롤 활성:

```css
.prose pre,
.code-card-body pre {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

`.code-card` 자체에 `overflow: hidden` 이 있다면 inner `pre` 의 가로 스크롤이 안 됨 — 그 경우 `.code-card { overflow: visible; }` 후 `.code-card-body { overflow-x: auto; }` 로 정정 필요. 실제 selector 구조 확인:

```bash
grep -n "\.code-card" src/app/globals.css
```

발견된 룰의 구조에 따라:
- `.code-card-body pre` 가 명시되어 있으면 거기 `overflow-x: auto` 추가
- 없으면 위 selector 그대로 추가

### 4. 회귀 테스트 — `MarkdownRenderer.regression-3.test.ts` 신규

source 파일 grep 으로 selector 존재 검증:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("plan035 모바일 가독성 룰 회귀 가드", () => {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf-8");
  const components = readFileSync(
    join(__dirname, "markdown/components.tsx"),
    "utf-8"
  );

  it("inline code 에 word-break: keep-all 룰 존재", () => {
    expect(css).toMatch(/word-break:\s*keep-all/);
  });

  it("inline code 에 overflow-wrap: anywhere 룰 존재 (fallback)", () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("코드 블록 overflow-x: auto 룰 존재", () => {
    expect(css).toMatch(/overflow-x:\s*auto/);
  });

  it("테이블 override 가 overflow-x-auto wrapper 사용", () => {
    expect(components).toMatch(/overflow-x-auto/);
  });

  it("테이블 override 가 min-width 명시", () => {
    expect(components).toMatch(/min-w-\[32rem\]/);
  });
});
```

### 5. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

grep -nE "word-break:\s*keep-all" src/app/globals.css
grep -nE "overflow-x:\s*auto" src/app/globals.css
grep -n "overflow-x-auto" src/components/markdown/components.tsx
grep -n "min-w-\[32rem\]" src/components/markdown/components.tsx
```

### 6. 모바일 smoke (사용자 안내)

`pnpm dev` 후 다음 페이지 모바일 viewport (Chrome DevTools mobile / agent-browser iPhone 14) 확인:

| URL | 검증 |
|---|---|
| `/posts/database/mysql/mysql-index-explain-commerce-api.md` | EXPLAIN 표 가로 스크롤 + 컬럼 폭 회복 + inline code (`type`, `key_len`) token 보존 |
| `/posts/database/mysql/mysql-index-explain-commerce-api.md` (스크롤) | SQL 코드 블록 가로 스크롤 동작 + `SELECT id, store_id, status, total_price` 끝까지 |
| 본문 일반 prose | `EXPLAIN`, `created_at` 등 inline code token 단위 wrap 유지 |

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/globals.css` | 수정 (inline code wrap + code block overflow-x) |
| `src/components/markdown/components.tsx` | 수정 (table wrapper override) |
| `src/components/MarkdownRenderer.regression-3.test.ts` | 신규 (회귀 가드) |

## Out of Scope

- 데스크톱 시각 변경 — 모든 룰은 모바일 영향 위주, 데스크톱 동일 보존
- 코드 블록 디자인 변경 (plan012 결과 보존)
- 테이블 디자인 변경 (단순 wrapper 만)
- prose 다른 영역 (이미지 / 인용 / 리스트) — 별도 plan 필요 시 후속

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| `word-break: keep-all` 으로 한국어 긴 어절이 잘 안 끊겨 horizontal overflow 발생 | `overflow-wrap: anywhere` fallback 으로 viewport 보다 긴 token 자동 wrap. 일반 한국어 어절 (3~5 chars) 은 영향 없음 |
| 테이블 wrapper 의 `-mx-4` 가 다른 prose 요소와 충돌 | wrapper 는 div 단일 자식 — Z-index / position 영향 없음. wrapping 은 명시적 (`<table>` 만 affected) |
| `.code-card { overflow: hidden }` 충돌로 inner pre 스크롤 막힘 | phase 시작 시 globals.css 의 `.code-card` 룰 grep → overflow 충돌 발견 시 wrapper / inner 분리 정정 |
| 회귀 테스트가 source grep 만 — 실제 렌더 결과 미검증 | 모바일 smoke 가이드 (작업 6) 필수 — 사용자 또는 executor 가 시각 확인 |
