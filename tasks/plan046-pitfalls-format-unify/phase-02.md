# Phase 02 — 인덱스 표 + 외부 참조 § 정리 + 검증 + 마킹

**Model**: sonnet
**Goal**: `common-pitfalls.md` 파일 상단에 인덱스 표 추가 + 외부 5개 파일 (`.claude/agents/self-healing-postmortem.md`, `.claude/skills/planning/SKILL.md`, `.claude/skills/planning/task-create.md`, `docs/adr.md`, `docs/code-architecture.md`) 의 § / 소진 등장 정리 + 통합 검증 + 마킹.

## 작업 항목

### 1. common-pitfalls.md 상단 인덱스 표 추가

파일 상단 (제목 `# Common Pitfalls` 다음, "축적 규칙" 섹션 앞) 에 인덱스 표 삽입.

표 형식:

```markdown
## 인덱스

| 항목 | 제목 | 키워드 | 호출 시점 |
|---|---|---|---|
| **섹션 1. plan 작성** | | | team-lead, critic |
| 1-1 | ... | ... | plan 작성 |
| ... (1-2 ~ 1-9 모두 한 행씩) | | | |
| **섹션 2. team 운영** | | | team-lead |
| 2-1 | ... | ... | team 운영 |
| ... (2-2 ~ 2-10 모두 한 행씩) | | | |
| **섹션 3. PR review 학습 (코드 패턴)** | | | code-reviewer, executor |
| 3-1 | ... | ... | code review |
| ... (3-2 ~ 3-20 모두 한 행씩) | | | |
| **섹션 4. 레포별 +α 패턴 (BLG)** | | | code-reviewer, executor |
| BLG1 | ... | ... | code review |
| ... (BLG2 ~ BLG25 모두 한 행씩) | | | |
```

executor 가 본문에서 각 항목의 헤더와 핵심 토큰을 추출해 표를 채운다. 형식 일관성 우선:

- "제목" 컬럼은 본문 헤더 (`## 1-1. 수치 추측 (파일 수 / 줄 수)`) 의 `1-1. ` 다음 부분
- "키워드" 는 본문에서 grep 가능한 핵심 토큰 2-3개
- "호출 시점" 은 섹션별 고정 (plan 작성 / team 운영 / code review)
- **"..." 생략 금지** — 모든 항목 (1-1~1-9, 2-1~2-10, 3-1~3-20, BLG1~BLG25) 각각 1행씩 채운다. 총 64 행 (헤더 4 + 1-N 9 + 2-N 10 + 3-N 20 + BLG 25 - 헤더 4 의 분리 행은 별도)

### 2. 외부 참조 5개 파일 § + 소진 정리

다음 파일에서 `§` + `소진` 등장 정리:

```bash
# cwd: <worktree root>
grep -rln "§\|소진" .claude/agents/ .claude/skills/ docs/
```

실측 파일 (현재 grep 결과 기준):

- `.claude/agents/self-healing-postmortem.md`
- `.claude/skills/planning/SKILL.md`
- `.claude/skills/planning/task-create.md`
- `docs/adr.md`
- `docs/code-architecture.md`
- (참고: `.claude/skills/_shared/common-pitfalls.md` 도 grep 에 잡히지만 phase-01 에서 이미 정리됨 — phase-02 작업 시점엔 0건)

각 파일에서 `§` / `소진` 등장을 다음 패턴으로 교체:

| 기존 | 교체 |
|---|---|
| `§ 1` / `§ 2` / `§ 3` / `§ 4` | `섹션 1` / `섹션 2` / `섹션 3` / `섹션 4` |
| `§ N-M` (예: `§ 1-5`) | `1-5` (섹션 prefix 자명) |
| `§ 4.fos-blog` 같은 직접 참조 | "섹션 4 (레포별 +α)" 로 풀어쓰기 |
| `소진 체크리스트` / `사전에 소진` 등 | `사전 점검 체크리스트` / `사전 해소` (dooray-cli 정책 — 자원 고갈 비유 회피) |

cross-link 깨짐 회피: 다른 docs 가 `§ 4. 레포별` 같은 정확 텍스트로 anchor 참조하는 경우 검색 후 동시 교체.

### 3. 통합 검증

```bash
# cwd: <worktree root>
# 모든 § / 소진 등장 0건 (외부 참조 파일 + common-pitfalls.md 모두)
grep -rn "§\|소진" .claude/ docs/   # 결과 없어야 함

# 인덱스 표 ↔ 본문 개수 정합 (실측 기준)
grep -cE "^\| BLG[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 25
grep -cE "^## BLG[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 25

grep -cE "^\| 1-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 9
grep -cE "^## 1-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 9
grep -cE "^\| 2-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 10
grep -cE "^## 2-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 10
grep -cE "^\| 3-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 20
grep -cE "^## 3-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 20

# 프로젝트 통합 검증 (docs/skill md 만 변경이라 빌드 영향 없어야 함)
pnpm lint && pnpm type-check && pnpm test --run && pnpm build
```

### 4. index.json status 마킹

`tasks/plan046-pitfalls-format-unify/index.json`:

- 최상위 `status` = `"completed"`
- `phases[0].status` = `"completed"`
- `phases[1].status` = `"completed"`

### 5. verification

```bash
# cwd: <worktree root>
grep -cE "\"status\": \"completed\"" tasks/plan046-pitfalls-format-unify/index.json   # 3
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `.claude/skills/_shared/common-pitfalls.md` | 수정 (인덱스 표 삽입) |
| `.claude/agents/self-healing-postmortem.md` | 수정 (§ 정리) |
| `.claude/skills/planning/SKILL.md` | 수정 (§ 정리) |
| `.claude/skills/planning/task-create.md` | 수정 (§ 정리) |
| `docs/adr.md` | 수정 (§ 정리) |
| `docs/code-architecture.md` | 수정 (§ 정리) |
| `tasks/plan046-pitfalls-format-unify/index.json` | 마킹 |

## Out of Scope

- 파일 분할 (안 2) — plan047 분리
- BLG 본문 의미 갱신 — phase-01 과 동일 원칙
- code-review-pitfalls.md 본문 변경
- `~/.claude/CLAUDE.md` 의 § 정책 본문 변경 — 이미 추가 완료 (별도 commit)
