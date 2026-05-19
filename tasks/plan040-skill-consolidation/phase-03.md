# Phase 03 — 통합 검증 + 폐기 잔재 grep + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase 01-02 결과를 grep / lint 로 통합 검증한다. 폐기된 skill 2개의 참조 잔재 0 건 + 흡수된 보강 마커 모두 출현을 확인. 마지막으로 `tasks/plan040-skill-consolidation/index.json` 의 status 를 모두 `completed` 로 마킹.

**범위 외**: 새 변경 추가 (phase 01-02 의 작업 자체).

---

## 작업 항목 (3)

### 1. 폐기 잔재 통합 grep

```bash
# cwd: <repo root>

# (a) commit-and-push 참조 잔재
grep -rnE "commit-and-push" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" > /tmp/p40-residue-commit.txt
wc -l < /tmp/p40-residue-commit.txt
# 기대: 0

# (b) self-healing-teams 참조 잔재 (단 self-healing-postmortem 은 별도 자원이므로 정확 매치)
grep -rnE "self-healing-teams\b" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" > /tmp/p40-residue-sh.txt
wc -l < /tmp/p40-residue-sh.txt
# 기대: 0

# (c) skill 디렉터리 실제 부재 확인
test ! -d .claude/skills/commit-and-push && echo "commit-and-push 폐기 OK"
test ! -d .claude/skills/self-healing-teams && echo "self-healing-teams 폐기 OK"
```

잔재가 발견되면 위치를 보고 후 phase 차단 (executor 가 phase 02 로 돌아가 처리해야 함 — 본 phase 는 검증 전용).

### 2. 흡수 마커 모두 출현 확인

```bash
# CLAUDE.md "Git & PR Conventions" 4개 sub-섹션
grep -cE "금지 파일 목록|package\.json.*pnpm-lock|PR 본문 포맷|의미 단위 atomic 커밋" CLAUDE.md
# 기대: ≥ 4

# build-with-teams SKILL.md 3개 흡수 마커
grep -cE "자주 발생하는 마찰 패턴|판정 시간 규칙 \(heartbeat\)|M4\. Post-mortem 학습 누적" .claude/skills/build-with-teams/SKILL.md
# 기대: ≥ 3

# F1-F5 패턴 표 모두 흡수
grep -cE "\*\*F[1-5]\*\*" .claude/skills/build-with-teams/SKILL.md
# 기대: 5

# hooks / agent 유지 자원
test -f .claude/hooks/agent-spawn-guard.sh && \
test -f .claude/hooks/branch-contamination-guard.sh && \
test -f .claude/agents/self-healing-postmortem.md && echo "유지 자원 OK"
```

### 3. 통합 빌드 + index.json 마킹

```bash
# 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
# 모두 exit 0

# index.json status 마킹
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan040-skill-consolidation/index.json
grep -c '"status": "completed"' tasks/plan040-skill-consolidation/index.json
# 기대: 4 (1 root + 3 phases)
```

수동 smoke (`pnpm dev` 또는 skill 호출 시뮬레이션은 본 plan scope 외 — 다음 build-with-teams 실행에서 자연 검증):
- skill 목록에서 commit-and-push / self-healing-teams 가 사라졌는지 (Claude Code 재시작 시 반영). 본 phase 는 파일 시스템 정합만 검증.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan040-skill-consolidation/index.json` | status 마킹 (pending → completed) |

## 검증

위 "폐기 잔재 통합 grep" + "흡수 마커 모두 출현 확인" + "통합 빌드" 블록을 그대로 실행. 모두 exit 0 + grep 기대값 충족 시 PASS.

## 의도 메모 (왜)

- **검증 전용 phase**: skill / docs 변경은 코드 회귀 가능성이 낮지만, 참조 잔재 (broken link) 는 향후 다른 작업에서 silently 실패 가능. grep 으로 명시적 확인이 가장 안전
- **`self-healing-teams\b` 단어 경계 매치**: self-healing-postmortem 은 별도 자원이라 단순 substring grep 으로는 false positive. word boundary 로 정확 매치 — phase 02 의 검증과 동일 패턴
