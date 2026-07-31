## ADR-026. 마크다운 원시 HTML을 HAST 단계에서 정제한다

- **결정**
  - `rehype-sanitize`를 `unified` 변환 파이프라인의 `rehype-raw` 뒤에 적용한다.
  - 기본 스키마를 확장해 Shiki와 코드 카드의 `figure`, `figcaption`, `code`, `span`, `pre`, `div` 속성을 허용한다.
  - KaTeX의 `aria-hidden`과 제목의 `id`도 보존한다.
  - `<script>`, `<iframe>`, 이벤트 처리 속성, `javascript:` URL은 차단한다.
  - 제목 `id`는 목차 링크와 일치하도록 `clobberPrefix` 없이 유지한다.
- **맥락**
  - 글 저장소가 신뢰된 소스여도 계정 침해나 향후 기여자 확대에 대비한 방어가 필요하다.
  - Mermaid SVG는 정제 이후 클라이언트 컴포넌트가 생성하므로 원시 HTML 허용 목록과 충돌하지 않는다.
- **기각한 대안**
  - `rehype-raw` 제거는 기존 글의 `<details>`, `<sub>` 등 원시 HTML 호환성을 깨뜨릴 수 있다.
  - 클라이언트 DOM 정제는 서버가 이미 생성한 HTML을 뒤늦게 처리한다.
- **결과**
  - Shiki가 새 속성을 추가하면 허용 목록과 회귀 테스트를 함께 갱신해야 한다.
  - 사용자 입력 마크다운을 도입하면 `clobberPrefix`와 허용 목록을 다시 검토한다.
