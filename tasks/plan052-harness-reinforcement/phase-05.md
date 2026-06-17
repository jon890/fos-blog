# Phase 05 — 통합 검증 + 참조 무결성 grep + completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan052 전체(phase 01~04)를 통합 검증한다. 특히 phase-01 의 adr 분해가 깨진 참조를 남기지 않았는지 확인하고 index.json 을 완료 처리한다.

**선행**: phase-01~04 완료.

---

## 작업 항목 (3)

### 1. adr 분해 참조 무결성

```bash
# cwd: <repo root>
# ADR 파일 번호 집합 (012 결번, 001~031 = 30개)
ls docs/adr/[0-9]*.md | grep -oE "[0-9]{3}" | sort | tr '\n' ' '
[ ! -f docs/adr.md ] && echo "adr.md 제거됨 ✓"

# 깨진 앵커 잔재 0
! grep -rn "(#adr-[0-9]" docs/ --include="*.md"           # exit 1 기대
! grep -rn "adr\.md#\|docs/adr\.md" docs/ .claude/ CLAUDE.md --include="*.md"   # 옛 단일 경로 참조 잔재 없어야

# INDEX 링크가 실제 파일과 정합 (링크된 파일이 모두 존재)
for f in $(grep -oE "\./[0-9]{3}-[a-z0-9-]+\.md" docs/adr/README.md); do
  [ -f "docs/adr/${f#./}" ] || echo "깨진 INDEX 링크: $f"
done
echo "INDEX 링크 정합 점검 완료"
```

### 2. 나머지 보강 확인

```bash
# cwd: <repo root>
grep -qE "축적 점검|prune" .claude/skills/_shared/common-pitfalls.md && echo "phase-02 ✓"
grep -qE "특이사항|pre-existing" .claude/skills/build-with-teams/SKILL.md && echo "phase-03 ✓"
grep -qE "gh pr list|열린 PR" .claude/skills/planning/SKILL.md && echo "phase-04a ✓"
[ -f .claude/agents/fos-blog-executor.md ] && echo "phase-04b ✓"

pnpm lint   # md 변경이라 통과 기대(코드 무변경 확인)
```

### 3. index.json 완료 마킹

`tasks/plan052-harness-reinforcement/index.json` 의 최상위 `status` 와 모든 phase `status` 를 `"completed"` 로 바꾼다.

```bash
# cwd: <repo root>
grep -c '"status": "completed"' tasks/plan052-harness-reinforcement/index.json   # 6 기대(최상위 1 + phase 5)
```

## 의도 메모 (왜)

- adr 분해 검증을 별도 phase 로 두는 이유: 29개 파일 분리 + 41건 참조 갱신은 누락이 쉬운 기계적 작업이라, 깨진 링크 grep 을 plan 종료 게이트로 강제한다.
- 코드 무변경 plan 이라 lint 만 — 이 plan 은 `.claude/`·`docs/` 메타 변경이고 `src/` 를 건드리지 않는다(건드렸으면 회귀).
