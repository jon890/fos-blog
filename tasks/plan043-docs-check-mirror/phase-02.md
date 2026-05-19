# Phase 02 — fos-blog 현 docs 에 dogfood + index.json 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 결과를 검증한다. fos-blog 현 docs (docs/adr.md / docs/pages/*.md) 에 새 3종 grep 을 dogfood 실행 — 현재 docs 상태가 새 규칙을 통과하는지 확인. 마지막으로 `tasks/plan043-docs-check-mirror/index.json` 의 status 를 모두 `completed` 로 마킹.

**범위 외**: dogfood 위반 발견 시 docs 수정 — 본 phase 는 검증 + 보고 전용. docs 수정은 사용자 의사결정 후 별도 작업.

---

## 작업 항목 (3)

### 1. SKILL.md 보강 마커 grep (phase 01 결과 검증)

```bash
# cwd: <repo root>

# 신규 섹션
grep -cE "^## 거울 구조 자동 검증" .claude/skills/docs-check/SKILL.md
# 기대: 1

# 3개 sub-섹션
grep -cE "^### \(a\) ADR 과대화|^### \(b\) page docs Related Files|^### \(c\) 문서 책임 표 위반" .claude/skills/docs-check/SKILL.md
# 기대: 3

# 위치 정합
A=$(grep -nE "^## 검증 5축" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
B=$(grep -nE "^## 거울 구조 자동 검증" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
C=$(grep -nE "^## 실행 절차" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
test "$A" -lt "$B" && test "$B" -lt "$C" && echo "위치 OK" || echo "위치 오류: A=$A B=$B C=$C"
# 기대: "위치 OK"
```

### 2. dogfood — 새 3종 grep 을 fos-blog 현 docs 에 실행

```bash
# cwd: <repo root>

echo "=== (a) ADR 과대화 검출 ==="
awk '
  /^## ADR-/ { adr=$0; code_lines=0; path_count=0; in_code=0; next }
  /^```/ {
    if (in_code) {
      if (code_lines > 10) print adr " — 코드 블록 " code_lines "줄 (>10)"
      code_lines=0
    }
    in_code = !in_code; next
  }
  in_code { code_lines++ }
  /^## / && !/^## ADR-/ {
    if (path_count >= 3) print adr " — 파일 경로 " path_count "개 (≥3)"
    path_count=0
  }
  /`[a-z_]+\/[a-zA-Z0-9_\/.-]+\.(ts|tsx|md|js|mjs|json|sql|sh)`/ { path_count++ }
  END {
    if (path_count >= 3) print adr " — 파일 경로 " path_count "개 (≥3)"
  }
' docs/adr.md
echo "--- (a) 끝 ---"

echo "=== (b) 깨진 Related Files 참조 ==="
for doc in docs/pages/*.md; do
  awk '
    /^## Related Files/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section {
      n = split($0, parts, "`")
      for (i=2; i<=n; i+=2) {
        p = parts[i]
        if (p ~ /^(src|drizzle|scripts|local|public)\//) print FILENAME ":" NR ": " p
      }
    }
  ' "$doc"
done | while IFS= read -r line; do
  path="${line##*: }"
  path="${path%% *}"
  test -e "$path" || echo "BROKEN: $line"
done
echo "--- (b) 끝 ---"

echo "=== (c) ADR 에 page docs 전용 헤딩 ==="
awk '
  /^## ADR-/ { adr=$0; next }
  /^### (Related Files|Components|Interactions|Client State|Server-side Processing|Layout|SEO|Data)/ {
    print adr " — page docs 전용 헤딩 출현: " $0
  }
' docs/adr.md
echo "--- (c) 끝 ---"
```

각 검증의 결과를 명시적으로 보고:
- 0건 → 현 docs 가 새 규칙 통과
- 1+건 → 위반 위치 출력. 사용자에게 보고만 — 본 phase 에서 수정 안 함 (의도 메모 참조)

### 3. 통합 검증 + index.json 마킹

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
# 기대: 둘 다 exit 0 (skill / docs 변경은 ts/lint 영향 0)

sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan043-docs-check-mirror/index.json
grep -c '"status": "completed"' tasks/plan043-docs-check-mirror/index.json
# 기대: 3 (1 root + 2 phases)
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan043-docs-check-mirror/index.json` | status 마킹 (pending → completed) |

## 검증

위 "SKILL.md 보강 마커 grep" + "dogfood 3종" + "통합 검증" 블록을 그대로 실행. 보강 마커 + 위치 정합 통과 + dogfood 결과 명시 보고 시 PASS.

## 의도 메모 (왜)

- **dogfood 결과 = 본 phase scope 외 수정 금지**: dogfood 에서 (a)/(b)/(c) 위반이 발견되어도 본 phase 에서 docs 수정 안 함 — 현재 docs 의 상태는 plan043 의 책임이 아니며, 수정은 사용자 의사결정 + 별도 PR 이 적절. 위반 위치 출력만으로 가치 (사용자가 별도 정리 plan 결정 가능)
- **dogfood 실패 ≠ phase 실패**: 본 phase 의 성공 기준은 "skill 본문 보강이 정합" + "새 grep 명령이 실행 가능". dogfood 결과 자체는 정보 출력. 위반 0건이 가장 깨끗하지만 위반 발견도 정상 (의도된 검출)
