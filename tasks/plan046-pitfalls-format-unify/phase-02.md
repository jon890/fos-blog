# Phase 02 — 인덱스 표 + 외부 참조 § 정리 + 검증 + 마킹

**Model**: sonnet
**Goal**: `common-pitfalls.md` 파일 상단에 인덱스 표 추가 + 다른 4개 파일 (planning task-create.md, planning SKILL.md, self-healing-postmortem.md, docs/code-architecture.md, docs/adr.md) 의 § 등장 정리 + 통합 검증 + 마킹.

## 작업 항목

### 1. common-pitfalls.md 상단 인덱스 표 추가

파일 상단 (제목 `# Common Pitfalls` 다음, "축적 규칙" 섹션 앞) 에 다음 표 삽입:

```markdown
## 인덱스

| 항목 | 제목 | 키워드 | 호출 시점 |
|---|---|---|---|
| **섹션 1. plan 작성** | | | team-lead, critic |
| 1-1 | 수치 추측 (파일 수 / 줄 수) | 파일 수, 줄 수, 카운트 | plan 작성 |
| 1-2 | 파일 범위 부정확 | 파일 범위, scope | plan 작성 |
| ... (1-3 ~ 1-9 + 사전 점검 체크리스트) | | | |
| **섹션 2. team 운영** | | | team-lead |
| 2-1 | 팀원 SendMessage 회신 누락 | SendMessage, idle | team 운영 |
| ... (2-2 ~ 2-10) | | | |
| **섹션 3. PR review 학습 (코드 패턴)** | | | code-reviewer, executor |
| 3-1 | Drizzle `count(*)` sql<T> 타입 | Drizzle, count, sql | code review |
| ... (3-2 ~ 3-17) | | | |
| **섹션 4. 레포별 +α 패턴 (BLG)** | | | code-reviewer, executor |
| BLG1 | Drizzle `db:push` 금지 (프로덕션) | Drizzle, db:push, migration | code review |
| BLG2 | pino 구조화 로그 컨텍스트 누락 | pino, logger, 4-field | code review |
| ... (BLG3 ~ BLG24) | | | |
```

executor 가 본문에서 각 항목 1줄씩 추출해서 표 완성. 형식 일관성 우선:

- "제목" 컬럼은 본문 헤더 (`## 1-1. 수치 추측 (파일 수 / 줄 수)`) 의 `1-1. ` 다음 부분
- "키워드" 는 본문에서 grep 가능한 핵심 토큰 2-3개
- "호출 시점" 은 본 phase 본문 (plan 작성 / team 운영 / code review)

### 2. 외부 참조 4개 파일 § + 소진 정리

다음 파일에서 `§` + `소진` 등장 정리:

```bash
# cwd: <worktree root>
grep -rln "§\|소진" .claude/agents/ .claude/skills/ docs/
```

예상 파일 (현재 grep 결과 기준):

- `.claude/agents/self-healing-postmortem.md`
- `.claude/skills/planning/task-create.md`
- `docs/code-architecture.md`
- `docs/adr.md`

각 파일에서 `§` / `소진` 등장을 다음 패턴으로 교체:

| 기존 | 교체 |
|---|---|
| `§ 1` / `§ 2` / `§ 3` / `§ 4` | `섹션 1` / `섹션 2` / `섹션 3` / `섹션 4` |
| `§ N-M` (예: `§ 1-5`) | `1-5` (섹션 prefix 자명) |
| `§ 4.fos-blog` 같은 직접 참조 | "섹션 4 (레포별 +α)" 로 풀어쓰기 |
| `소진 체크리스트` / `사전에 소진` 등 | `사전 점검 체크리스트` / `사전 해소` (dooray-cli 정책 — 자원 고갈 비유 회피) |

`common-pitfalls.md` 안에서 § / 소진 가 0건임은 phase-01 에서 이미 검증.

### 3. 통합 검증

```bash
# cwd: <worktree root>
# 모든 § / 소진 등장 0건 (외부 참조 파일 + common-pitfalls.md 모두)
grep -rn "§\|소진" .claude/ docs/   # 결과 없어야 함

# 인덱스 표 ↔ 본문 BLG 개수 정합
grep -cE "^\| BLG[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 24
grep -cE "^## BLG[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 24

# 인덱스 표 ↔ 본문 1-M / 2-M / 3-M 정합
grep -cE "^\| 1-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 9
grep -cE "^## 1-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 9
grep -cE "^\| 2-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 10
grep -cE "^## 2-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 10
grep -cE "^\| 3-[0-9]+" .claude/skills/_shared/common-pitfalls.md   # 17
grep -cE "^## 3-[0-9]+\." .claude/skills/_shared/common-pitfalls.md  # 17

# 프로젝트 통합 검증 (docs 만 변경이라 빌드 영향 없어야 함)
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
grep -c "\"completed\"" tasks/plan046-pitfalls-format-unify/index.json   # 3
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `.claude/skills/_shared/common-pitfalls.md` | 수정 (인덱스 표 삽입) |
| `.claude/agents/self-healing-postmortem.md` | 수정 (§ 정리) |
| `.claude/skills/planning/task-create.md` | 수정 (§ 정리) |
| `docs/code-architecture.md` | 수정 (§ 정리) |
| `docs/adr.md` | 수정 (§ 정리) |
| `tasks/plan046-pitfalls-format-unify/index.json` | 마킹 |

## Out of Scope

- 파일 분할 (안 2) — plan047 분리
- BLG 본문 의미 갱신 — phase-01 과 동일 원칙
- code-review-pitfalls.md 본문 변경
- `~/.claude/CLAUDE.md` 의 § 정책 본문 변경 — 이미 추가 완료 (별도 commit)
