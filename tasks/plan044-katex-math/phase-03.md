# Phase 03 — 회귀 테스트 + 통합 검증 + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

KaTeX 통합의 핵심 동작을 Vitest 로 회귀 보호. 인라인 + 블록 수식 / invalid LaTeX fallback / sanitize 통과 여부 / 다크모드 색 inherit 모두 검증. lint / type-check / test / build 전체 통과 + `tasks/plan044-katex-math/index.json` status 마킹.

**범위 외**: 새 plugin 추가 (phase 01-02 의 작업).

---

## 작업 항목 (3)

### 1. `src/components/markdown/unified-pipeline.test.ts` — KaTeX 회귀 테스트 추가

기존 test 파일에 KaTeX 케이스 4개 추가:

```ts
describe("KaTeX math rendering (plan044)", () => {
  it("인라인 수식 $x^2$ 가 span.katex 으로 변환", async () => {
    const md = "이것은 $x^2$ 수식.";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain('class="katex"');
    expect(html).toContain("x");  // 수식 내용 보존
  });

  it("블록 수식 $$...$$ 가 span.katex-display 으로 변환", async () => {
    const md = "$$\\int_0^1 x\\,dx$$";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    expect(html).toContain("katex-display");
  });

  it("invalid LaTeX 은 빨간 텍스트 fallback (throwOnError: false)", async () => {
    const md = "$\\frac{1}$";  // 분모 누락
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    // rehype-katex 버전마다 fallback 표현이 다름: className `katex-error` 또는 inline `color:#cc0000`.
    // 둘 중 하나라도 출현하면 OK. 위 await 가 throw 안 한 사실 자체가 throwOnError:false 동작을 증명.
    expect(html).toMatch(/katex-error|color\s*:\s*#?cc0000/i);
  });

  it("KaTeX 출력 className 이 sanitize 통과 (katex prefix)", async () => {
    const md = "$a + b$";
    const tree = await parseMarkdownToHast(md);
    const html = toHtml(tree);
    // sanitize 후에도 katex 클래스 유지
    expect(html).toMatch(/class="[^"]*katex[^"]*"/);
  });
});
```

상단 import 추가 (기존 test 파일의 vitest + parseMarkdownToHast import 아래에 추가):
```ts
import { toHtml } from "hast-util-to-html";
```

기존 test 파일은 이미 상단에 `vi.mock("server-only", () => ({}));` 가드를 두고 있어 `parseMarkdownToHast` import 가 vitest node 환경에서도 안전 — 추가 mock 불필요.

`hast-util-to-html` 이 dependencies 에 없으면 추가:
```bash
# cwd: <repo root>
pnpm add -D hast-util-to-html
```

(devDependencies 로 — test 에서만 사용)

### 2. 통합 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
# 모두 exit 0 + KaTeX 4 케이스 PASS

# sanitize strip 회귀 검증은 위 4번째 vitest 케이스 ("KaTeX 출력 className 이 sanitize 통과") 가 담당.
# 별도 node -e TS import 는 Node 단독으로 .ts 실행 불가 (tsx 필요) — vitest 결과로 충분.
```

### 3. 수동 smoke + index.json 마킹

`pnpm dev` 후 수식 글 (테스트용 한 줄 글이라도) 작성:

```markdown
인라인: $x^2 + y^2 = z^2$
블록:
$$
\int_0^1 x\,dx = \frac{1}{2}
$$
invalid: $\frac{1}$
```

수동 확인 항목 (executor 가 명시 보고):
- 인라인 수식 렌더 (글자와 같은 baseline)
- 블록 수식 렌더 (가운데 정렬, 큰 사이즈)
- invalid 수식이 빨간 텍스트 표시 + 페이지 깨지지 않음
- 다크 모드 토글 — 수식 색이 본문 텍스트 색 따라감 (검정 → 흰색 류)
- 라이트 모드 — 수식 색이 검정 (본문과 동일)

index.json 마킹:
```bash
# cwd: <repo root>
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan044-katex-math/index.json
grep -c '"status": "completed"' tasks/plan044-katex-math/index.json
# 기대: 4 (1 root + 3 phases)
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/markdown/unified-pipeline.test.ts` | KaTeX 4 케이스 추가 |
| `package.json` / `pnpm-lock.yaml` | `hast-util-to-html` devDependency 추가 (없으면) |
| `tasks/plan044-katex-math/index.json` | status 마킹 (pending → completed) |

## 검증

위 "통합 검증" 명령 블록 + Vitest 4 케이스 PASS + 수동 smoke 5항목 모두 명시 보고 시 PASS.

## 의도 메모 (왜)

- **4 테스트 케이스**: 인라인 / 블록 / invalid / sanitize 통과 — KaTeX 통합의 핵심 회귀 모두 커버. 다크모드 색은 CSS 라 unit test 어려움 → 수동 smoke 로 위임
- **`hast-util-to-html` devDependency**: 테스트에서 hast tree 를 HTML 문자열로 변환해 검증. 운영 코드는 hast tree 를 jsx-runtime 으로 React element 변환 (toHtml 안 씀). 따라서 devDependency
- **invalid LaTeX fallback**: rehype-katex 의 throwOnError:false 동작 — 빌드 안 깨짐 + 사용자 즉시 인지. 버전마다 fallback 표현이 다름 (`katex-error` className 또는 inline `color:#cc0000`) — 정규식으로 둘 다 허용. 이 동작이 회귀하면 (예: throw 로 변경) 빌드 실패 사고
