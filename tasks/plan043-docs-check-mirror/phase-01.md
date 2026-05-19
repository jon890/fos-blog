# Phase 01 — docs-check/SKILL.md 에 거울 구조 grep 검증 3종 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/docs-check/SKILL.md` 에 거울 구조 (planning "문서 책임 표") 정합성을 자동 grep 으로 검증하는 신규 섹션을 추가한다. 3종 검증:

- **(a) ADR 과대화**: ADR 한 항목 안에 코드 블록 10줄+ / 파일 경로 3개+ 검출
- **(b) page docs Related Files 정합**: `docs/pages/*.md` 의 ` `src/...`` 경로가 실제 파일에 존재하는지
- **(c) 문서 책임 표 위반**: `docs/adr.md` 에 `Related Files` / `Components` / `Interactions` 같은 page docs 전용 섹션 헤딩 등장 (B2 옵션 — 분명한 신호만)

**범위 외**: hook 자동화 (사용자 명시 거부, docs-check 호출 시점만). 다른 skill 본문 변경.

---

## 작업 항목 (3)

### 1. `.claude/skills/docs-check/SKILL.md` — "## 거울 구조 자동 검증 (3종 grep)" 신규 섹션 추가

위치: 현재 "## 검증 5축" 섹션 (L23) 끝, "## 실행 절차" 섹션 (L100) 직전에 신규 추가.

본문:

```markdown
## 거울 구조 자동 검증 (3종 grep)

planning skill 의 "문서 책임 표" (단일 소스 원칙) 위반과 깨진 참조를 자동 검출한다. 5축 의미 검증과 별도로, docs-check 호출 시 가장 먼저 실행 — fail-fast.

### (a) ADR 과대화 검출

ADR 한 항목이 자명성 게이트 (planning "ADR 자명성 게이트") 의 금지 조건을 위반하는가:

- 코드 블록 10줄 이상 (식별자 예시는 1~3줄만 허용)
- 파일 경로 3개 이상 나열

```bash
# cwd: <repo root>
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
# 기대: 0건 출력 — 발견 시 해당 ADR 정리 필요
```

### (b) page docs Related Files 정합

`docs/pages/*.md` 의 "Related Files" 섹션에 나열된 코드 경로가 실제 파일 시스템에 존재하는가:

```bash
# cwd: <repo root>
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
  # bash parameter expansion 으로 path 추출 (subshell PATH 이슈 회피)
  path="${line##*: }"      # 마지막 ": " 이후
  path="${path%% *}"        # 첫 공백 앞까지
  test -e "$path" || echo "BROKEN: $line"
done
# 기대: "BROKEN:" 출력 0건
```

깨진 참조 발견 시 AskUserQuestion 흐름 (각 깨진 경로마다):

- 옵션 1: **docs 행 제거** — 코드에서 삭제된 컴포넌트
- 옵션 2: **docs 경로 수정** — 파일이 이동/rename 됨, 새 경로 지정
- 옵션 3: **파일 복구 필요** — 의도하지 않은 삭제, 코드 쪽 수정 필요

### (c) 문서 책임 표 위반 (ADR 에 page docs 전용 헤딩)

`docs/adr.md` 에 page docs / code-architecture 전용 섹션 헤딩이 등장하는가. 등장하면 책임 분리 위반 (한 ADR 안에서 페이지 PRD 를 재서술 중):

```bash
# cwd: <repo root>
awk '
  /^## ADR-/ { adr=$0; next }
  /^### (Related Files|Components|Interactions|Client State|Server-side Processing|Layout|SEO|Data)/ {
    print adr " — page docs 전용 헤딩 출현: " $0
  }
' docs/adr.md
# 기대: 0건 — 발견 시 해당 ADR 본문을 결정/맥락/대안 기각 형태로 정리
```

검출되는 헤딩 목록 (B2 옵션 — 분명한 신호만):
- `Related Files` (page docs 전용)
- `Components` (page docs 전용)
- `Interactions` (page docs 전용)
- `Client State` (page docs 전용)
- `Server-side Processing` (page docs 전용)
- `Layout` (page docs 전용)
- `SEO` (page docs 전용)
- `Data` (page docs 전용, "## Data" 형식)

위 헤딩이 ADR 안에 있으면 → 해당 정보는 `docs/pages/{page}.md` 단일 소스로 이전 + ADR 에는 결정 근거만 남김.

### 호출 시점

본 3종 grep 은 `/docs-check` 호출 시 "## 실행 절차" 의 "1. 대상 파일 수집" 직후 자동 실행. PreCommit hook 등 별도 자동화 없음 (skill 호출 시점만).

검출 결과는 "## docs-check 결과" 의 **Critical** 카테고리에 자동 분류 — (a) 과대화 / (b) 깨진 참조 / (c) 책임 위반 모두 즉시 수정 권장 등급.
```

위 블록을 `## 검증 5축` 섹션 *끝*, `## 실행 절차` 섹션 *직전* 에 삽입.

### 2. `.claude/skills/docs-check/SKILL.md` — "## 실행 절차" 의 "1. 대상 파일 수집" 항목 갱신

현재 (L123 부근):
```markdown
### 1. 대상 파일 수집
```

본문 끝에 1줄 추가:
```markdown
**자동 grep 검증 사전 실행**: 대상 파일 수집 직후, 의미 검증 (5축) 전에 위 "거울 구조 자동 검증 (3종 grep)" 의 3개 명령을 실행한다. 검출 결과는 의미 검증과 함께 최종 리포트의 Critical 섹션으로 통합.
```

### 3. `.claude/skills/docs-check/SKILL.md` — "## docs-check 결과" 의 "Critical" 섹션에 분류 추가

현재 (L180 부근):
```markdown
### Critical (즉시 수정 권장)
```

본문 끝에 sub-bullet 4개 추가:

```markdown
- 부패 / 오정합 (의미 검증 5축 A 결과)
- 거울 구조 위반 — 자동 grep 검출 (위 "거울 구조 자동 검증" 섹션):
  - (a) ADR 과대화 — 코드 블록 10줄+ 또는 파일 경로 3+
  - (b) 깨진 Related Files 참조
  - (c) ADR 에 page docs 전용 헤딩 등장
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/docs-check/SKILL.md` | 신규 섹션 "거울 구조 자동 검증 (3종 grep)" + "1. 대상 파일 수집" 보강 + "Critical" 섹션 분류 추가 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan043-docs-check-mirror-impl (build-with-teams 자동 생성)

# 1. 신규 섹션 헤딩 출현
grep -cE "^## 거울 구조 자동 검증" .claude/skills/docs-check/SKILL.md
# 기대: 1

# 2. 3개 sub-섹션 헤딩
grep -cE "^### \(a\) ADR 과대화|^### \(b\) page docs Related Files|^### \(c\) 문서 책임 표 위반" .claude/skills/docs-check/SKILL.md
# 기대: 3

# 3. 각 grep 명령 본문 흡수 — 핵심 키워드
grep -cE "BROKEN:" .claude/skills/docs-check/SKILL.md
# 기대: ≥ 1 (b 검증 명령)
grep -cE "code_lines > 10" .claude/skills/docs-check/SKILL.md
# 기대: ≥ 1 (a 검증 명령)

# 4. "1. 대상 파일 수집" 갱신
grep -cE "자동 grep 검증 사전 실행" .claude/skills/docs-check/SKILL.md
# 기대: 1

# 5. Critical 섹션 분류 추가
grep -cE "거울 구조 위반 — 자동 grep 검출" .claude/skills/docs-check/SKILL.md
# 기대: 1

# 6. 위치 검증 — 거울 구조 섹션이 5축 끝과 실행 절차 사이
A=$(grep -nE "^## 검증 5축" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
B=$(grep -nE "^## 거울 구조 자동 검증" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
C=$(grep -nE "^## 실행 절차" .claude/skills/docs-check/SKILL.md | head -1 | cut -d: -f1)
test "$A" -lt "$B" && test "$B" -lt "$C" && echo "위치 OK" || echo "위치 오류: A=$A B=$B C=$C"
# 기대: "위치 OK"

# 7. pnpm lint
pnpm lint
```

## 의도 메모 (왜)

- **B2 (섹션 헤딩 중복) 만 채택**: B1 (키워드 중복) 은 코드 식별자가 ADR 본문에 등장할 정당한 케이스 (결정 근거 설명 등) 가 많아 false positive 양산. 섹션 헤딩 중복은 분명한 책임 분리 위반 신호 — false positive 거의 0
- **호출 시점만 (hook 없음)**: docs 변경마다 hook 으로 검증하면 무관한 commit (예: 오타 수정) 도 hook 실행. /docs-check 호출 시점에만 실행이 사용자 의도에 정합
- **AskUserQuestion 흐름 (b)**: 깨진 참조는 의도가 다양 — rename / 삭제 / 미커밋 등. 자동 수정 위험. 사용자가 옵션 1-3 중 선택
- **(a) 의 파일 경로 검출 regex**: ADR 본문의 ` `src/foo/bar.ts` ` 같은 백틱 인라인 경로 매치. 확장자 화이트리스트로 단순 ``...`` (식별자 / 명령) 와 구분
