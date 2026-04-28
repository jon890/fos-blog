## 코드 리뷰 — feat(markdown): MarkdownRenderer → server async (drop react-markdown, ADR-020)

production에서 분 단위로 폭증하던 `runSync finished async` 오류를 근본적으로 제거한 올바른 리팩터링입니다. RSC 표준 패턴(`toJsxRuntime` + components mapping)의 적용이 정확하고, `passNode: true` 명시, singleton 패턴의 race 방지, `server-only` 가드, 회귀 테스트 추가까지 꼼꼼하게 처리되어 있습니다.

---

### 🟡 개선 권장

**`src/components/markdown/components.tsx` — 79번째 줄**
문제: `findChildText(hastNode, "figcaption")`가 `string | undefined`를 반환하지만, `CodeCard`의 `filename` prop에 타입 선언 없이 직접 전달
수정: `const filename = findChildText(hastNode, "figcaption") ?? undefined;` 로 의도를 명시하거나 주석 보완

**`src/components/markdown/components.tsx` — 183번째 줄**
문제: `resolveMarkdownLink(href!, basePath)` — `isRelativeMd === true`이면 href가 non-null임이 논리적으로 보장되지만 TypeScript가 추론하지 못해 `!` assertion 필요
수정: `if (isRelativeMd && basePath && href)` 타입 가드로 assertion 제거

**`src/components/markdown/components.tsx` — 239번째 줄**
문제: `src`가 string이 아닐 경우 빈 문자열 `""`를 Next.js `Image`에 전달 → 오류 또는 broken image 가능
수정: `if (!src || typeof src !== "string") return null;` 조건부 렌더링 추가

**`src/components/markdown/components.tsx` — 245번째 줄**
문제: `style={{ width: "100%", height: "auto" }}`에서 `height: auto`는 `h-auto`와 중복, `width: 100%`는 Tailwind `w-full`로 대체 가능. inline style 사용은 프로젝트 컨벤션상 권장하지 않음
수정: style prop 제거 후 `className="my-4 rounded-lg shadow-lg w-full h-auto"`

**`src/components/markdown/unified-pipeline.ts` — 16번째 줄**
문제: `allowDangerousHtml: true` + `rehypeRaw` 조합으로 마크다운 내 raw HTML이 검증 없이 렌더링됨. 콘텐츠 출처가 GitHub(신뢰된 레포)이므로 즉각적인 위험은 낮지만, fos-study 레포 write 권한을 가진 contributor가 악의적인 HTML을 삽입할 수 있는 잠재적 공격 벡터
수정: 장기 과제로 `rehype-sanitize` 추가 또는 허용 HTML 요소 화이트리스트 도입 검토

**`src/components/markdown/components.tsx` — 전체 파일 (일반)**
문제: CLAUDE.md 규칙상 `src/components/markdown/*`는 모두 `import "server-only"` 가드 대상이나, `components.tsx`에는 누락되어 있음 (unified-pipeline.ts는 올바르게 적용됨)
수정: `components.tsx`가 클라이언트에서 accidentally import될 위험이 있다면 파일 최상단에 `import "server-only";` 추가 — 단, Client Component import와의 충돌 여부 확인 후 적용

---

### 🟢 잘 된 점

- `processorPromise` module-level singleton으로 동시 요청 race condition 방지

- `passNode: true` 명시 — 누락 시 figure/pre 핸들러의 node prop이 undefined가 되어 코드블록 분기 전체가 무력화되는 치명적 버그를 사전 차단
- `"use client"` 완전 제거 및 server async component 전환 — BLG6 잘못 마킹 상태 해소
- `vi.mock("server-only", () => ({}))` 추가로 vitest node 환경에서 회귀 테스트가 실제로 실행 가능
- shiki 코드블록 렌더링 및 mermaid 감지 회귀 테스트 2건 신규 추가
- react-markdown 제거로 번들 순감 + unified 계열 패키지 direct dep promote로 의존성 투명성 개선
- `createMarkdownComponents(basePath)` factory 패턴으로 a 핸들러의 basePath closure 캡처
---

🤖 Reviewed with [Claude Code](https://claude.com/claude-code) (parallel agents: TypeScript · Conventions · Security · Architecture)
💬 인라인 코멘트는 **Files changed** 탭에서 확인하세요
