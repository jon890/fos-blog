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
# ─── 본문 충실도 게이트 (핵심 — 분리 중 본문 유실/변형/이동을 ADR 번호별로 검출) ───
# 전제: 분해를 아직 커밋하지 않은 상태(executor 는 커밋 안 함) → HEAD 에 원본 adr.md 존재.
#       이미 커밋했다면 HEAD 를 분해 직전 커밋으로 바꿔 비교.
# 주의: adr.md 본문은 숫자 순이 아니다(실측: 018 이 017 앞에 위치). 단순 concat+diff 는 정상 분리에도
#       거짓 실패하므로, ADR 번호별로 구 섹션 본문 ≡ 신규 NNN-*.md 본문을 개별 비교한다(순서 독립).
#       awk: `## ADR-<n>.` 부터 다음 `## ADR-` 직전까지 추출. 앵커/구분선/빈줄은 정규화로 제거. 031 은 신규라 제외.
FAIL=0
for nnn in $(ls docs/adr/[0-9]*.md | grep -oE "[0-9]{3}" | grep -v "^031$"); do
  old=$(git show HEAD:docs/adr.md \
        | awk -v n="$nnn" '/^## ADR-/ { if (inb) exit; if ($0 ~ "^## ADR-"n"\\.") inb=1 } inb { print }' \
        | grep -vE '^<a id="adr-|^---$|^[[:space:]]*$')
  new=$(cat docs/adr/${nnn}-*.md | grep -vE '^<a id="adr-|^---$|^[[:space:]]*$')
  [ "$old" = "$new" ] || { echo "❌ ADR-$nnn 본문 불일치 (유실/변형/이동)"; FAIL=1; }
done
[ "$FAIL" -eq 0 ] && echo "본문 동일성 ✓ (ADR 번호별 개별 비교, 유실/이동 0)"

# ADR 파일 번호 집합 단언 (012 결번, 001~031 = 30개)
N=$(ls docs/adr/[0-9]*.md | grep -oE "[0-9]{3}" | sort -u | wc -l | tr -d ' ')
[ "$N" -eq 30 ] && echo "ADR 파일 30개 ✓" || echo "❌ ADR 파일 $N 개 (30 기대)"
[ ! -f docs/adr.md ] && echo "adr.md 제거됨 ✓"

# 깨진 앵커 잔재 0
! grep -rn "(#adr-[0-9]" docs/ --include="*.md"           # exit 1 기대
! grep -rn "adr\.md#\|docs/adr\.md" docs/ .claude/ CLAUDE.md --include="*.md"   # 옛 단일 경로 참조 잔재 없어야

# INDEX ↔ 파일 양방향 정합
# (a) INDEX → 파일 (링크된 파일이 모두 존재)
for f in $(grep -oE "\./[0-9]{3}-[a-z0-9-]+\.md" docs/adr/README.md); do
  [ -f "docs/adr/${f#./}" ] || echo "깨진 INDEX 링크: $f"
done
# (b) 파일 → INDEX (신규 ADR 파일이 INDEX 에 누락되지 않았는지 — 고아 방향)
for f in $(ls docs/adr/[0-9]*.md | xargs -n1 basename); do
  grep -q "$f" docs/adr/README.md || echo "INDEX 누락: $f"
done
echo "INDEX ↔ 파일 양방향 정합 점검 완료"
```

### 2. 나머지 보강 확인

```bash
# cwd: <repo root>
grep -qE "축적 점검|prune" .claude/skills/_shared/common-pitfalls.md && echo "phase-02 ✓"
grep -qE "특이사항|pre-existing" .claude/skills/build-with-teams/SKILL.md && echo "phase-03 ✓"
grep -qE "gh pr list|열린 PR" .claude/skills/planning/SKILL.md && echo "phase-04a ✓"
[ -f .claude/agents/fos-blog-executor.md ] && echo "phase-04b ✓"
grep -qiE "native teams|TeamCreate 도구는 없" .claude/skills/build-with-teams/SKILL.md && echo "phase-04c ✓"
! grep -q "oh-my-claudecode:executor" .claude/skills/build-with-teams/SKILL.md && echo "고아 executor 참조 0 ✓"

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
