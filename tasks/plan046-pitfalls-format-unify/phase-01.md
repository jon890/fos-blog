# Phase 01 — BLG1~BLG24 형식 통일 + § 제거 (common-pitfalls.md 본문)

**Model**: sonnet
**Goal**: `common-pitfalls.md` 의 BLG1~BLG24 항목을 다른 섹션 (1-1~1-9, 2-1~2-10, 3-1~3-17) 과 동일한 헤더 + sub-bullet 형식으로 재작성. 동시에 본문에 사용된 `§` 기호를 한국어 표현으로 일괄 교체.

## 컨텍스트

현재 `.claude/skills/_shared/common-pitfalls.md` 구조:

- 섹션 1. plan 작성 (critic 회피) — 1-1~1-9: `## N-M. {제목}` 헤더 + 본문 (양호)
- 섹션 2. team 운영 — 2-1~2-10: 동일 형식 (양호)
- 섹션 3. PR review 학습 (코드 패턴) — 3-1~3-17: 동일 형식 (양호)
- 섹션 4. 레포별 +α 패턴 — **BLG1~BLG24: bullet 1줄 안에 증상/Good/검출/Why 압축 (형식 일탈)**

형식 일탈만 정리. 섹션 1~3 본문 변경 금지.

추가로 본문 전체에 `§ 1`, `§ 2` 등 섹션 기호 21회 사용 → 사용자 정책 (글로벌 CLAUDE.md "Markdown 작성 함정") 으로 제거. "섹션 N" 또는 단순 "N." 로 교체.

BLG 번호 순서 문제도 동시 해결:

- 현재 순서: BLG1, BLG2, ..., BLG13, **BLG15, BLG16, BLG17, BLG14**, BLG18, BLG19, BLG20, BLG21, BLG23, **BLG24, BLG22**
- BLG14 가 BLG17 뒤, BLG24 가 BLG22 앞에 끼어있음 (추가 시점 순서)
- 재작성하면서 1~24 순차 정렬

## 작업 항목

### 1. BLG1~BLG24 헤더 형식 재작성

각 항목을 다음 4-section 형식으로 변환:

```markdown
## BLG{N}. {짧은 패턴 제목} (PR #{N} 관측)

**증상**: {기존 증상 본문}.

**Good**: {기존 해결책 본문}.

**검출**: {기존 검출 명령}.

**Why**: {기존 Why 본문}.
```

규칙:

- 기존 한 줄 bullet 의 4가지 정보 (증상/Good/검출/Why) 를 그대로 보존하되 sub-section 으로 분리
- 추가/삭제 없이 단순 형식 재작성 (의미 변경 금지)
- 짧은 항목 (BLG1~BLG5 처럼 sub-section 4개 다 안 채우는 것) 은 가능한 부분만 채움. 억지로 채우지 않음
- 1~24 순차 배치 (BLG14, BLG24 위치 정정)

### 2. 섹션 4 헤더 자체 변경

현재 본문:

```
# § 4. 레포별 +α 패턴 (Stage 0 시드)
```

→

```
# 섹션 4. 레포별 +α 패턴 (Stage 0 시드)
```

섹션 1, 2, 3 헤더도 동일하게 `# § N.` → `# 섹션 N.` 교체.

### 3. 본문 안 § 등장 일괄 정리

`common-pitfalls.md` 안의 모든 `§` 등장 — 다음 패턴으로 교체:

| 기존 | 교체 |
|---|---|
| `§ 1` / `§ 2` / `§ 3` / `§ 4` (단독 섹션 참조) | `섹션 1` / `섹션 2` / `섹션 3` / `섹션 4` |
| `§ 1 소진 체크리스트` (헤더) | `섹션 1 사전 점검 체크리스트` |
| `§ 1-5` (하위 항목 참조) | `1-5` (섹션 prefix 자명, 단순 번호) |
| `§ N. {제목}` (헤더 자체) | 작업 2 와 합쳐서 처리 |
| `소진 하면` / `소진 체크리스트` / `사전에 소진` 등 (어색한 한국어 표현, dooray-cli 정책) | `사전 점검` / `사전 점검 체크리스트` / `사전 해소` (문맥에 맞게) |

`grep -n "§\|소진" .claude/skills/_shared/common-pitfalls.md` 결과 0건이어야 통과.

### 4. 의미 변경 금지 검증

재작성 후 BLG 본문이 의미적으로 보존됐는지 점검:

```bash
# cwd: <worktree root>
# 재작성 전 BLG 항목별 키워드 추출 (의미 보존 비교용)
git show HEAD:.claude/skills/_shared/common-pitfalls.md | grep -E "^- \*\*BLG[0-9]+" | wc -l
# 결과: 24

# 재작성 후 ## BLG 헤더 개수
grep -cE "^## BLG[0-9]+\." .claude/skills/_shared/common-pitfalls.md
# 결과: 24

# 두 수가 일치해야 함
```

### 5. 자동 verification

```bash
# cwd: <worktree root>
grep -c "§" .claude/skills/_shared/common-pitfalls.md   # 0
grep -cE "^## BLG[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 24
grep -cE "^# 섹션 [0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 4

# BLG 번호 순차 (1~24)
grep -oE "^## BLG[0-9]+" .claude/skills/_shared/common-pitfalls.md | \
  sed 's/## BLG//' | \
  awk 'BEGIN{prev=0; ok=1} {if ($1 != prev+1) {ok=0; print "OUT_OF_ORDER:", prev, "->", $1; exit 1} prev=$1} END{if(ok) print "ORDERED"}'
# 결과: ORDERED
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `.claude/skills/_shared/common-pitfalls.md` | 수정 (BLG 24항목 재작성 + 헤더/§ 교체) |

## Out of Scope

- 파일 분할 (안 2) — `code-review-pitfalls.md` 로 섹션 3+4 이전. plan047 분리
- 인덱스 표 추가 — phase-02 분리
- 외부 참조 파일 (planning task-create.md, self-healing-postmortem.md 등) 의 § 정리 — phase-02 분리
- BLG 본문의 의미 갱신 / 신규 항목 추가 / 중복 BLG 통합 — 본 phase 단순 형식 재작성만
- code-review-pitfalls.md 본문 변경

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| 재작성 중 BLG 의미 누락 (특히 BLG6, BLG9 처럼 본문 긴 항목) | 작업 4 의 개수 검증 + 재작성 직후 BLG 별 키워드 (`db:push`, `passNode`, `eval`, `notInArray` 등) grep 으로 보존 확인 |
| BLG 번호 정렬 시 외부 참조 (BLG3-8 등) 깨짐 | 본 phase 는 BLG 번호 자체는 변경 안 함 (1~24 그대로), 단순히 본문 안 위치만 순차 정렬. 외부 참조는 BLG# 그대로 |
| 섹션 헤더 (# 섹션 N) 변경이 외부 참조 깨뜨림 | phase-02 에서 외부 참조 정리. 본 phase 는 내부만 |
