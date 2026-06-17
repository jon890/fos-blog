# Phase 01 — adr.md 를 docs/adr/NNN-slug.md + INDEX 로 분해 (ADR-031)

**Model**: sonnet
**Status**: pending

---

## 목표

단일 `docs/adr.md`(29개 ADR, 563줄)를 ADR 1개 = 파일 1개(`docs/adr/NNN-slug.md`) + INDEX 라우터로 분해한다.
PR 마다 같은 파일 끝줄(새 ADR + 인덱스 카운트)에서 나던 머지 충돌을 구조적으로 제거한다.
이 분해 결정 자체를 ADR-031 로 남긴다.

**배경**: plan051(PR #176)과 본 plan 이 실제로 adr.md 를 동시 수정해 충돌 위험을 겪었다. 검증된 구조(회피 패턴 wiki 의 파일-per-패턴)를 ADR 로 이식한다.

**범위 외**: pitfalls 운영(phase-02), SKILL 보강(phase-03·04). 이 phase 는 adr.md 분해만.

---

## 작업 항목 (5)

### 1. docs/adr/ 디렉터리 + ADR 29개 파일 분리

`docs/adr.md` 의 각 `## ADR-NNN. {제목}` 섹션(앵커 `<a id="adr-NNN">` 부터 다음 ADR 직전 `---` 까지)을 `docs/adr/NNN-slug.md` 로 분리한다.

- 파일명: `NNN-slug.md` — `NNN` 은 3자리 0 패딩(`001`, `030`), `slug` 는 제목 핵심을 kebab-case 로(예: ADR-001 무한 스크롤 → `001-infinite-scroll-page.md`, ADR-030 다중 카테고리 → `030-multi-category.md`).
- 번호를 파일명에 **유지**하는 이유: 코드·docs 의 `ADR-NNN` 텍스트 참조(47건)가 `NNN-*.md` glob 으로 찾아지고, `참조-NNN` 텍스트가 안 깨진다.
- 각 파일 본문 = 해당 ADR 섹션 그대로(제목 `## ADR-NNN. ...` 포함). 파일 상단 앵커(`<a id>`)는 단일 파일용이라 제거한다(파일 자체가 단위).
- 결번(ADR-012)은 파일을 만들지 않는다. 결번 보존 정책은 INDEX 에 한 줄 남긴다.
- 본문을 **한 글자도 바꾸지 않는다** — 분리만. 분리 정확성은 작업 5 에서 grep 으로 검증.

기계적 분리라 awk 스크립트 사용을 권장(`# cwd: <repo root>`):

```bash
# cwd: <repo root>
# ADR 섹션 경계(<a id="adr-NNN"> ~ 다음 <a id> 직전)를 추출하는 방식. slug 는 분리 후 수동 rename.
# 스크립트 자동 생성이 어려우면 ADR 단위로 직접 추출 — 단 본문 동일성 필수.
```

### 2. docs/adr/README.md — INDEX 라우터 생성

기존 `adr.md` 상단의 "ADR Index"(분류별 링크 목록)를 `docs/adr/README.md` 로 옮긴다.

- 각 링크를 `[ADR-NNN](./NNN-slug.md) — 1줄 요약` 형태로(앵커 `#adr-NNN` → 파일 경로).
- 기존 분류(콘텐츠 & UX / 데이터 & API / …) 헤더 유지.
- 상단에 "ADR 1개 = 파일 1개. 새 ADR 은 `docs/adr/NNN-slug.md` 추가 + 이 INDEX 에 링크 한 줄. 결번(012 등)은 재사용하지 않는다(결번 보존)." 운영 규칙 명시.

### 3. ADR-031 신규 — docs/adr/031-adr-file-split.md

분해 결정 자체를 ADR 로 남긴다(기존 ADR 템플릿: 결정/맥락/대안 기각/트레이드오프).

- **결정**: adr.md 단일 → `docs/adr/NNN-slug.md` + README INDEX. 번호 파일명 유지로 참조 보존.
- **맥락**: 단일 파일이 PR 마다 끝줄 충돌. plan051·plan052 가 실측으로 겪음.
- **대안 기각**: 단일 유지(충돌 지속) / 신규부터 점진 분해(단일+분리 혼재로 발견성 저하).
- **트레이드오프**: 일회성 29파일 분리 + 참조 갱신 비용. 이후 본문 충돌 0(INDEX 1줄만 잔여, 번호순 인접 추가라 자동 해소).

README INDEX 의 적절한 분류(예: "메타 / 문서 구조")에 ADR-031 링크도 추가한다.

### 4. 참조 갱신 — 앵커 링크 + 경로 언급

분해로 깨지는 참조를 갱신한다.

```bash
# cwd: <repo root>
# (a) docs 내부 마크다운 앵커 링크 (#adr-NNN) — 약 41건
grep -rn "#adr-[0-9]" docs/ --include="*.md"
# → [ADR-NNN](#adr-NNN) / [ADR-NNN](./adr.md#adr-NNN) 를 [ADR-NNN](./adr/NNN-slug.md) (상대경로 보정)로

# (b) adr.md 경로를 가리키는 docs/스킬/CLAUDE.md 언급
grep -rn "docs/adr\.md\|adr\.md" docs/ .claude/ CLAUDE.md --include="*.md"
# → docs/adr/ (디렉터리) 또는 docs/adr/README.md 로

# (c) 코드 주석의 ADR-NNN 텍스트(47건)는 번호만이라 보존 — 링크 형태(#adr-NNN)만 갱신
```

분해된 ADR 파일 **상호 참조**(예: ADR-008 본문의 `[ADR-017](#adr-017)`)도 같은 디렉터리 내 `[ADR-017](./017-slug.md)` 로 갱신한다.

### 5. docs/adr.md 제거

분리·INDEX·참조 갱신 완료 후 `git rm docs/adr.md`. README 가 진입점을 대체한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `docs/adr/NNN-slug.md` (29개) | 신규 — ADR 개별 분리 |
| `docs/adr/031-adr-file-split.md` | 신규 — 분해 결정 ADR |
| `docs/adr/README.md` | 신규 — INDEX 라우터 |
| `docs/adr.md` | 삭제 |
| docs/ 내 `#adr-NNN` 링크 보유 파일 | 수정 — 경로 갱신 |
| `.claude/`·`CLAUDE.md` 의 adr.md 경로 언급 | 수정 — 경로 갱신 |

## 검증

```bash
# cwd: <repo root>
# 분리 정확성 — 분해 전후 ADR 본문 동일성(번호 집합 일치)
ls docs/adr/0*.md docs/adr/[0-9]*.md | grep -oE "[0-9]{3}" | sort | tr '\n' ' '   # 001..011 013..031
grep -c "^## ADR-" docs/adr/*.md | grep -v ":1$" || echo "각 파일 ADR 헤더 정확히 1개 ✓"

# adr.md 제거 확인
[ ! -f docs/adr.md ] && echo "adr.md 제거됨 ✓"

# 깨진 앵커 참조 0 — 옛 #adr-NNN 앵커 링크 잔재 없어야
! grep -rn "(#adr-[0-9]" docs/ --include="*.md"            # exit 1 기대(잔재 없음)
! grep -rn "adr\.md#" docs/ .claude/ --include="*.md"      # adr.md 앵커 참조 잔재 없어야

# INDEX 가 29 + ADR-031 = 30개 링크 보유
grep -c "\./[0-9]\{3\}-" docs/adr/README.md                # 30 기대

pnpm lint   # md 무관하나 절차상
```

## 의도 메모 (왜)

- 번호를 파일명에 유지하는 이유: `ADR-NNN` 텍스트 참조(코드 47건)가 `NNN-*.md` glob 으로 찾아져 깨지지 않는다. slug 만 쓰면 참조가 끊긴다.
- 본문을 한 글자도 안 바꾸는 이유: 분해는 구조 변경이지 내용 변경이 아니다. 내용 수정이 섞이면 충돌 해소 효과를 검증할 수 없다.
- ADR-031 을 분해 산출물로 두는 이유: planning 단계에서 adr.md 에 미리 추가하면 그 자체가 또 단일 파일 충돌이 된다. 분해와 함께 새 파일로 생성해 충돌 표면을 늘리지 않는다.
