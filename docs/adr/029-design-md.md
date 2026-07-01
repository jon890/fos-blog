## ADR-029. DESIGN.md 자립형 도입 + globals.css 를 토큰 source of truth 로 유지

- **결정**: AI agent 가 디자인을 일관되게 생성하도록 [Google Stitch DESIGN.md 컨벤션](https://github.com/voltagent/awesome-design-md) 9섹션 형식의 자립형 `docs/design.md` 를 도입한다. 단 토큰 값의 단일 소스는 `src/app/globals.css` 의 `@theme` 블록으로 유지하고, design.md 는 사람·외부 agent 용 스냅샷으로 둔다. 값 불일치 시 `globals.css` 가 우선한다.
- **맥락**: AGENTS.md 가 코딩 agent 지침을 표준화하듯 DESIGN.md 가 디자인 agent 지침을 표준화하는 흐름. fos-blog 의 디자인 결정([ADR-017](./017-design-system.md))과 토큰은 `globals.css`·`design-inspiration.md`·여러 ADR 에 흩어져 있어, 외부 agent 가 한 번에 읽을 진입점이 없었다.
- **대안 기각**:
  - **DESIGN.md 미도입** 기각 — 코드를 읽을 수 있는 agent 에겐 중복이지만, 외부 design agent·사람에게는 토큰이 흩어져 있어 일관 생성이 어렵다. 단일 진입점 가치가 중복 비용보다 크다.
  - **포인터형(값 복제 없이 globals.css 참조만)** 기각 — 자립적으로 읽히지 않아 외부 agent 핸드오프 시 globals.css 동반 필요. Stitch 컨벤션의 "툴 없이 markdown 만으로 읽힌다" 이점 상실.
- **트레이드오프**: 자립형이라 oklch 값이 `globals.css` 와 design.md 두 곳에 존재 → dual source 동기화 위험. "globals.css 우선" 명시 + 토큰 변경 시 design.md 표 동반 갱신 규칙으로 완화. 향후 빈도가 잦아지면 globals.css → design.md 자동 생성 스크립트를 별도 plan 으로 검토.
- **적용 범위**: design.md 는 확정된 현재 상태, [design-inspiration.md](./design-inspiration.md) 는 생성 과정(영감 보드 + Claude Design 프롬프트)으로 역할이 다르다.
