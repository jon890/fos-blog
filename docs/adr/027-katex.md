# ADR-027. 서버 마크다운 변환에서 KaTeX 수식을 렌더링한다

## 맥락과 결정

콘텐츠에 인라인·블록 LaTeX 수식이 늘어 기존 unified 변환에 수식 렌더링을 추가했다.
remark-math와 rehype-katex를 사용하고 출력은 `html`로 정했다.
플러그인 순서와 모듈 책임은 [마크다운 렌더링](../code-architecture.md#마크다운-렌더링),
허용 속성은 [sanitize 스키마](../../src/components/markdown/sanitize-schema.ts)를 따른다.

## 이유와 기각한 대안

- MathJax보다 기존 unified와 직접 연결할 수 있는 KaTeX 플러그인을 선택했다.
- 도입 당시 브라우저별 MathML 차이와 sanitize 허용 태그 확대를 피하려고 `htmlAndMathml`을 기각했다.
  HTML 출력으로 범위를 좁혀 `math`와 `annotation` 태그를 추가하지 않았다.
- span의 `className`에 KaTeX 전용 정규식만 덧붙이는 대안은 기각했다.
  기존의 단순 `className` 허용과 정규식 항목은 OR로 결합되므로 허용 범위가 좁아지지 않는다.
  반대로 전체 허용을 제거하면 Shiki의 코드 강조가 깨질 수 있다.

## 감수하는 비용과 검증

KaTeX CSS를 전역에서 가져오므로 수식이 없는 페이지에도 해당 스타일을 제공한다.
CSS 적용과 테마별 표현은 [globals.css](../../src/app/globals.css)가 소유한다.

현재 플러그인은 잘못된 수식에서 변환 전체를 중단하지 않는 기본 동작을 사용한다.
라이브러리를 업그레이드할 때는 잘못된 수식 처리와 sanitize 이후 수식·코드 강조를 함께 검증한다.
MathML 출력으로 바꾸려면 브라우저 차이와 허용 태그를 별도로 검토한다.
