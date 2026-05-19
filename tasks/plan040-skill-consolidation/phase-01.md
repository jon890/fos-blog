# Phase 01 — commit-and-push 폐기 + CLAUDE.md Git & PR Conventions 보강

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/commit-and-push/` 디렉터리를 제거하고, 잔존 가치 4개 항목을 CLAUDE.md "Git & PR Conventions" 섹션에 흡수한다. 사용 빈도 0 인 skill 폐기 + 규칙은 단일 소스 (CLAUDE.md) 로 통합.

**범위 외**: self-healing-teams 폐기 (phase 02). 다른 skill 의 본문 변경 (phase 02 또는 별도 plan).

---

## 작업 항목 (3)

### 1. `.claude/skills/commit-and-push/` 디렉터리 삭제

```bash
# cwd: <repo root>
rm -rf .claude/skills/commit-and-push
ls .claude/skills/commit-and-push 2>&1 | grep -q "No such" && echo "삭제 확인"
```

부수 효과 확인:
```bash
# 다른 skill / agent / docs 에서 commit-and-push 참조 검색
grep -rnE "commit-and-push" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" | head -20
# 기대: 0건 (참조 잔재 0)
```

참조 잔재가 발견되면 각 파일 수정 — 이번 phase scope 안.

### 2. `CLAUDE.md` "Git & PR Conventions" 섹션 (L279 부근) 확장

현재 섹션은 PR 제목 포맷 + 브랜치 prefix 표만 포함. 아래 **4개 sub-섹션** 추가:

#### (a) 금지 파일 목록 (커밋 차단 대상)

다음 파일은 git 추적 / 커밋 금지. 발견 시 즉시 stop:

- `.env` / `.env.local` / `.env*.local` — 환경 시크릿
- `*.pem` / `id_rsa` / `credentials.*` / `secrets.*` — 키/자격증명
- `.next/` / `node_modules/` / `.omc/` — 빌드/도구 산출물
- `drizzle/` 마이그레이션 — **예외**: `drizzle/AGENTS.md` 는 허용 (CLAUDE.md "DB 스키마 변경 규칙" 의 마이그레이션 SQL 커밋 정책과 별개로, 자동 생성 SQL 은 git 추적되지만 수동 편집 금지 의미)

의심 시 stop 후 사용자에게 확인.

#### (b) `package.json` ↔ `pnpm-lock.yaml` 동시 커밋

`pnpm-lock.yaml` 변경 (`pnpm add` / `pnpm remove` / `pnpm update` 결과) 은 **반드시 `package.json` 변경과 같은 커밋에 포함**. 분리하면 CI 의 `--frozen-lockfile` 단계가 실패.

검출:
```bash
git status --short | grep -E "^(M|A) pnpm-lock\.yaml" && \
  ! git diff --cached --name-only | grep -q "package\.json"
# 출력 있으면 (lockfile staged + package.json 미포함) → stop
```

#### (c) PR 본문 포맷

`gh pr create --body` HEREDOC 으로 다음 포맷:

```markdown
## Summary
- {핵심 변경 한 줄}
- {핵심 변경 한 줄}

## Test plan
- [ ] {검증 방법 — 자동 또는 수동}
- [ ] {검증 방법}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

`Summary` 는 변경의 *왜* 와 *무엇*. `Test plan` 은 reviewer 가 머지 전 확인할 항목. 항목 0 개면 PR 본문 생략 (단발 docs PR 등 예외 명시).

#### (d) 의미 단위 atomic 커밋

여러 관심사를 한 커밋에 섞지 않는다. 관심사별 분리 예시:

- 기능 변경 파일 → `feat: ...`
- 스킬/설정 파일 → `chore: ...`
- 문서 변경 → `docs: ...`

다만 **강하게 연관된 파일은 함께** — 예: `package.json` + `pnpm-lock.yaml`, schema 변경 + 그에 따른 `drizzle/*.sql`.

커밋 단위 검증:
```bash
# 한 커밋에 src/ 변경 + docs/ 변경 + .claude/ 변경이 모두 있으면 분리 후보
git show --stat HEAD | tail -20
```

#### 보호 규칙 (이미 CLAUDE.md "LLM 코딩 사고 원칙" 에 있음 — 중복 작성 금지)

- `main` / `master` 직접 push 금지 (PR 경로 강제) — 이미 user CLAUDE.md "Executing actions with care" 에 있음
- `--force` / `--no-verify` 사용 금지 — 이미 user CLAUDE.md 에 있음

본 섹션에서는 **위 4개 sub-섹션만 추가**. 보호 규칙은 user CLAUDE.md 가 단일 소스.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/commit-and-push/` | 디렉터리 삭제 |
| `CLAUDE.md` | "Git & PR Conventions" 섹션 4개 sub-섹션 추가 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan040-skill-consolidation-impl (build-with-teams 자동 생성)

# 1. 디렉터리 삭제 확인
test ! -d .claude/skills/commit-and-push && echo "삭제 OK"

# 2. 참조 잔재 0
grep -rnE "commit-and-push" .claude/ docs/ CLAUDE.md 2>&1 | grep -v "^Binary" | wc -l
# 기대: 0

# 3. CLAUDE.md 보강 4개 sub-섹션 마커 확인
grep -cE "금지 파일 목록|package\.json.*pnpm-lock|PR 본문 포맷|의미 단위 atomic 커밋" CLAUDE.md
# 기대: ≥ 4 (각 sub-섹션 헤딩 1회씩)

# 4. lint (CLAUDE.md 자체는 lint 대상 아니지만 hook 이 lint 실행)
pnpm lint
```

## 의도 메모 (왜)

- **CLAUDE.md 단일 소스**: 4개 sub-섹션의 단일 소스를 CLAUDE.md 로 일원화. skill 본문이 별도 소스가 되면 시간 지나면서 한쪽만 갱신되는 사고 (자가 모순)
- **보호 규칙 중복 금지**: 보호 브랜치 / force push / no-verify 는 user CLAUDE.md (`~/.claude/CLAUDE.md`) 에 이미 있음. 본 섹션에서 다시 쓰지 않음 — "거울 구조 원칙" 위반 회피
- **drizzle/AGENTS.md 예외 명시**: 자동 생성 SQL 은 git 추적되지만 (CLAUDE.md "DB 스키마 변경 규칙"), 디렉터리 전체 금지 라고 단순 표기하면 혼동 — 예외 명시
