## ADR-019. 코드 강조는 rehype-pretty-code와 Shiki 이중 테마를 사용한다

- **결정**:
  - `rehype-pretty-code`와 Shiki의 `github-light`, `github-dark` 테마를 함께 생성한다.
  - `figure[data-rehype-pretty-code-figure]`는 HAST 컴포넌트 매핑에서 `CodeCard`로 렌더링한다.
  - 파일명은 `figcaption`, 언어는 `code[data-language]`에서 읽는다.
  - Mermaid 블록은 `data-language="mermaid"`를 기준으로 코드 카드 변환을 우회한다.
  - 인라인 코드는 강조 대상에서 제외하고 코드 블록 배경은 사이트 토큰으로 관리한다.
- **맥락**:
  - highlight.js의 단일 CSS 테마 방식은 다크 모드와 라이트 모드를 함께 제공하기 어렵다.
  - 파일명, 복사 버튼, 줄 강조를 일관된 코드 카드 안에 배치하려면 변환 결과의 `figure` 구조를 활용하는 편이 단순하다.
  - 현재 마크다운은 비동기 unified 파이프라인에서 HAST를 JSX로 변환하므로 이 경계에서 서버 변환과 클라이언트 동작을 분리할 수 있다.
- **대안 기각**:
  - highlight.js 테마 CSS를 모드별로 교체하면 테마 전환과 코드 카드 구조를 별도로 관리해야 한다.
  - 모든 `<pre>`를 같은 방식으로 처리하면 Mermaid 블록까지 Shiki 코드 블록으로 렌더링된다.
  - 인라인 코드까지 Shiki로 처리하면 본문용 CSS 토큰과 불필요하게 충돌한다.
- **구현 계약**:
  - `rehype-pretty-code`가 `.shiki` 클래스를 항상 제공한다고 가정하지 않는다.
  - 이중 테마 색상 변수와 Mermaid 우회는 `src/components/markdown/unified-pipeline.test.ts`에서 회귀 검증한다.
