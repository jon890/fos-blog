## ADR-020. 마크다운 변환을 react-markdown(sync) → unified async 로 전환 (plan014)

- **결정**: react-markdown 의존성 제거. `unified.process()` async + `hast-util-to-jsx-runtime` 으로 마크다운을 server component 에서 직접 처리. CodeCard / Mermaid 는 client island 그대로 유지.
- **맥락**: ADR-019 (rehype-pretty-code + shiki dual theme) 도입 후 production server log 에 `Error: 'runSync' finished async. Use 'run' instead` (digest `1174120868` / `2958684477`) 가 분 단위로 폭증. react-markdown 9.x 는 sync only (`processor.runSync()`) 인데 shiki async highlighter 가 첫 호출 시 lazy init → 충돌. SSR 첫 패스 (server) 에서 발생하며 `MarkdownRenderer` 가 `"use client"` 마킹돼도 RSC 환경 server 패스를 우회 못 함. `useState`/`useEffect` 등 client-only 기능은 사용 0건 — 잘못 마킹된 상태였음.
- **대안 기각**:
  - shiki sync mode (`createHighlighterCoreSync`) — dual theme + 다중 언어 시 lazy load 회피 어려움. 사용자 선택지 좁아짐
  - theme dual → single — 라이트/다크 토글 색 깨짐, 디자인 시스템 (ADR-017/019) 후퇴
  - react-markdown 의 async 모드 — 라이브러리 미지원 (sync 전용 설계)
- **트레이드오프**: react-markdown 의 `components` prop 사용 코드를 `hast-util-to-jsx-runtime` 형태로 일괄 이전 필요. 번들은 순수 감소 (react-markdown 제거, unified / remark-parse / remark-rehype / hast-util-to-jsx-runtime 은 transitive 였음 → direct dep promote 만).
