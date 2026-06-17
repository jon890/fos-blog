# Phase 03 — build-with-teams 특이사항 4종 집계 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/build-with-teams/SKILL.md` 에 **특이사항 4종 집계** 규칙을 추가한다.
각 executor 가 phase 보고에 특이사항을 적고, team-lead 가 종료 시 누적해 사용자에게 명시 보고하게 한다.
현재는 "task 범위 외 수정 금지"(자체 판단 차단)는 있으나, 발견한 특이사항을 구조적으로 집계·보고하는 규칙이 없어 후속 누락이 생긴다.

**범위 외**: pitfalls(phase-02), planning/agent(phase-04).

---

## 작업 항목 (2)

### 1. "특이사항 4종 집계" 섹션 추가

build-with-teams SKILL.md 의 phase 보고·종료 보고 관련 위치(executor 보고 규칙 또는 team-lead 종료 절차 근처)에 추가한다.

각 executor 는 phase 보고에 아래 4종을 함께 적는다. 없으면 "없음" 으로 명시한다(침묵으로 갈음 금지 — 사용자 미인지 종료 시 후속 누락).

- **pre-existing** — 이번 변경과 무관하게 원래 있던 문제(기존 TS 에러·deprecated 사용 등).
- **신규 deprecation** — 이번 변경이 유발한 라이브러리 경고·예정 폐기.
- **미검증** — 로컬에서 확인 불가해 운영·검증 단계로 넘긴 영역(예: MySQL 컨테이너 부재로 미적용 migration).
- **범위 외 발견** — plan 범위 밖이지만 후속이 필요한 발견.

team-lead 는 종료 시 phase 별 특이사항을 누적해 사용자에게 명시 보고한다. 출처는 brain `build-with-teams-rules`(repo 무관 규칙).

### 2. 기존 "task 범위 외 수정 금지" 와 연결

기존 규칙(범위 외 코드를 executor 가 자체 판단으로 고치지 않음 — SendMessage 로 team-lead 에 보고)과 이 4종 집계가 짝임을 1줄로 연결한다. "범위 외 발견" 4종 항목이 그 보고의 누적 채널이다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/build-with-teams/SKILL.md` | 수정 — 특이사항 4종 집계 섹션 |

## 검증

```bash
# cwd: <repo root>
grep -niE "특이사항|pre-existing|신규 deprecation|미검증|범위 외 발견" .claude/skills/build-with-teams/SKILL.md | head
```

## 의도 메모 (왜)

- 4종으로 분류하는 이유: "특이사항 있음/없음" 만으로는 executor 가 무엇을 보고할지 모호해 침묵한다. 4종 체크리스트가 보고 누락을 0 으로 수렴시킨다.
- "없음 명시" 강제 이유: 침묵과 "특이사항 없음" 을 구분해야 사용자가 후속 필요 여부를 판단한다.
