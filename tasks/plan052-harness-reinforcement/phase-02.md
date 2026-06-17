# Phase 02 — common-pitfalls 운영 규율 (축적 점검 4조건 + prune/automate 패스)

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/_shared/common-pitfalls.md`(864줄)에 **축적 운영 규율**을 추가한다.
현재 패턴이 ADD 로만 늘어 토큰을 잠식하므로, 새 패턴 추가 전 통과해야 할 조건과 주기적 정리 패스를 명문화한다.

**범위 외**: 파일 per 패턴 분해(구조 변경)는 이번 범위 아님 — 단일 파일 유지 + 운영 규율만. 기존 BLG#·P# 패턴 내용은 건드리지 않는다.

---

## 작업 항목 (2)

### 1. "축적 운영 규율" 섹션 신설 (파일 상단 — 패턴 목록 앞)

common-pitfalls.md 의 패턴 목록이 시작되기 전, 문서 도입부에 다음 규율 섹션을 추가한다.

**축적 점검 4조건** — 새 패턴을 추가하기 전 모두 통과해야 한다. 하나라도 미달이면 PR 답글·커밋 메시지로 끝내고 파일에 적재하지 않는다.

- 재발성 — 2회 이상 재발했거나 다른 코드에서도 날 구조적 가능성이 있다.
- 심각도 — 데이터 손상·빌드 전체 실패·보안 등 영향이 크다.
- 도구로 못 잡음 — 린터·타입체커·테스트가 이미 잡는 건 추가하지 않는다(도구가 단일 소스).
- 추상화 가능 — 특정 인시던트를 넘어 일반화된다.

**prune·automate 패스** — 회고가 ADD 로만 기울지 않게 주기적으로 정리한다(회고 10회마다 또는 분기 1회).

- prune — 가리키는 코드가 사라진 stale 패턴 삭제, 같은 커널의 중복 패턴 병합.
- automate — 린터 규칙·ast-grep·테스트로 승격 가능한 패턴은 도구로 옮기고 항목 삭제.

각 항목은 1줄 + 이유. 출처는 brain `self-improving-harness` 패턴(repo 무관 운영 규율).

### 2. 패턴 작성 형식 1줄 명시

규율 섹션 끝에 신규 패턴 작성 형식(이미 BLG# 가 따르는 형식)을 1줄로 못박는다 — "BLG#/P#: 증상 → Good(해결+검출 명령) → Why". 검출 명령(grep 등)을 함께 적어 다음 작업의 사전 self-check 로 쓰이게 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/_shared/common-pitfalls.md` | 수정 — 축적 운영 규율 섹션 추가(상단) |

## 검증

```bash
# cwd: <repo root>
grep -niE "축적 점검|재발성|prune|automate" .claude/skills/_shared/common-pitfalls.md | head   # 규율 섹션 존재
# 기존 패턴 수 보존(내용 미변경 — BLG/P 개수 유지)
grep -cE "^\*\*(BLG|P|CLI)[0-9]" .claude/skills/_shared/common-pitfalls.md   # 분해 전 개수와 동일해야
```

## 의도 메모 (왜)

- 운영 규율을 파일 자체에 두는 이유: 회고를 누적하는 주체(review-fix·critic)가 같은 파일을 열 때 규율을 바로 본다. 별도 회고 문서를 신설하면 그게 또 rot 소스가 된다(거울 구조 원칙).
- 분해(파일 per 패턴)를 안 하는 이유: 스킬 로드 시 단일 파일이 grep·참조에 유리한 면이 있어, 우선 운영 규율로 무한 성장을 막고 분해는 필요 시 별도 plan 으로 판단한다.
