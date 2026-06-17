## ADR-019. 코드 블록 하이라이팅 — rehype-highlight → rehype-pretty-code + shiki dual theme (plan012)

**Context**: `rehype-highlight + highlight.js` 는 CSS import 방식 (`highlight.js/styles/github-dark.css`) 으로 다크/라이트 테마 전환을 위해 별도 CSS 클래스 토글이 필요. 코드 블록 UI 프레임 (filename header / 언어 배지 / copy 버튼 / line numbers / line-highlight / diff·terminal variants) 을 추가하려면 모두 자체 wrapper 가 필요해 markup 이 무거워짐. plan011 (article page redesign) 의 `.prose :not(pre) > code` 인라인 코드 룰 + `.prose pre.mermaid` mermaid 격리 selector 와 호환되는 정합성 이슈도 있음.

**Decision**:

- **`rehype-pretty-code` (shiki 기반)** 채택. dual theme `{ light: "github-light", dark: "github-dark" }` 구성 → CSS variable (`--shiki-light` / `--shiki-dark`) 기반 토글 한 줄 (`html.dark .code-card-body pre span { color: var(--shiki-dark); }`) 로 다크/라이트 전환. **셀렉터 주의 (plan017)**: rehype-pretty-code v14 는 `.shiki` className 을 부여하지 않으므로 `.shiki` 셀렉터는 매칭 실패 → `.code-card-body pre span` 으로 토큰 span 직접 타깃. `unified-pipeline.test.ts` 가 이 계약 (className 부재 + `--shiki-light`/`--shiki-dark` 변수 보유) 을 회귀 테스트로 고정
- **`figure data-rehype-pretty-code-figure` 출력 구조 활용**: react-markdown `components.figure` 핸들러가 figure 를 받아 신규 `<CodeCard>` (client wrapper, copy 버튼) 로 교체. filename 은 자식 figcaption.textContent, language 는 자식 code.data-language 에서 추출 (헬퍼 `findChildText` / `findCodeProp` 을 `src/lib/markdown.ts` 에 신설)
- **mermaid 우회**: pretty-code Options 에 `filter` 가 없어 (fictional API), `data-language === "mermaid"` 검사로 우회. `components.figure` / `isMermaidPreNode()` 모두 `data-language` 기반 분기 + 기존 className 기반 검사 (legacy 호환) 동시 지원
- **`bypassInlineCode: true`**: plan011 의 `.prose :not(pre) > code` 인라인 룰 보존. inline code 는 shiki 처리 skip
- **`keepBackground: false`**: 코드 블록 배경은 우리 `.code-card-body` frame 토큰이 winner

**Why**:

- **dual theme 가벼움**: shiki CSS variable 방식이 라이트/다크 토글 한 줄로 가능 — light/dark 별 CSS 파일 import 토글 패턴 (highlight.js) 보다 가볍고 `html.dark` 컨벤션 (ADR-017) 과 자연스럽게 어울림
- **figure 구조 → 자연스러운 wrapper 주입**: pretty-code 가 이미 figure 로 wrap 한다는 사실을 활용해 react-markdown components.figure 한 핸들러로 모든 frame 도입 (filename / 언어 배지 / copy / line-highlight / diff·terminal variants 모두 동일 구조)
- **mermaid 우회 비용 0**: 사전 rehype 플러그인 추가 없이 단일 selector 변경 (`className` → `data-language`) 으로 plan011 mermaid 격리와 정합

**Implementation 순서**: plan012 phase-01 (의존성 교체 + CodeCard + frame 토큰 + 헬퍼 + 회귀 9 케이스). caching/CSP/getHighlighter allowlist 등 후속 최적화는 별도 plan.

> plan014 후속: shiki async highlighter 와 react-markdown sync 처리의 충돌 (`Error: 'runSync' finished async`) 발견 → 마크다운 변환을 react-markdown(sync) 에서 unified async 로 이전. ADR-020 참조.
