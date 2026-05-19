# Phase 01 — review-fix/SKILL.md 에 로컬 재현 단계 추가

**Model**: sonnet
**Status**: pending

---

## 목표

`.claude/skills/review-fix/SKILL.md` 의 "1단계: CI 상태 점검" 흐름에 **로컬 재현** sub-단계를 추가한다.
CI FAILURE 감지 시:
1. `AskUserQuestion` 으로 "로컬 재현 할까요?" 사용자 confirm
2. 실패한 체크 이름/로그에 1:1 매칭되는 pnpm 명령만 실행
3. 결과를 추가 정보로 보고 — 자동 fix 금지, 사용자 의사결정에 위임

**범위 외**: 자동 fix 적용 (사용자 명시 거부, 의도 보존 우선). 다른 skill 본문 변경 (review-fix 만).

---

## 작업 항목 (3)

### 1. `.claude/skills/review-fix/SKILL.md` — "CI 픽스 흐름" 섹션 (L68) 직전에 "로컬 재현" sub-섹션 신규 추가

위치: 현재 "### CI 실패 흔한 원인 → 해결 표" 직후, "### CI 픽스 흐름" 직전.

본문:

```markdown
### CI 실패 → 로컬 재현 (사용자 confirm 후 — 권장)

CI 픽스 흐름으로 넘어가기 전에 **로컬에서 동일 실패가 재현되는지 먼저 확인**한다. 이유:

- 로컬 PASS + CI FAIL = CI 환경 특수성 (env vars / OS / 의존성 / actions tag 등) — 코드 fix 가 아닌 CI 설정 fix 필요
- 로컬 FAIL = 코드 자체 회귀 — 표 매칭으로 즉시 픽스 가능

**사용자 confirm 우선 (필수)**: 로컬 재현은 시간이 걸리므로 (`pnpm test` / `pnpm build` 는 수십초~수분) AI 자체 판단으로 실행하지 않는다. `AskUserQuestion` 호출:

- 옵션 1: **로컬 재현 (권장)** — 실패한 체크에 매칭되는 명령만 실행
- 옵션 2: skip — 로그 기반으로 바로 픽스 흐름
- 옵션 3: 전체 파이프라인 — `lint && type-check && test && build` 모두 (시간 ↑)

### 실패 체크 → 로컬 명령 매칭 표

`gh pr checks <N>` 의 실패 체크 이름 또는 `--log-failed` 로그 키워드를 보고 실행할 명령만 선택. 불필요한 명령 실행 회피.

| CI 체크 이름 / 로그 키워드 | 로컬 명령 | 기대 소요 |
|---|---|---|
| `Lint`, `eslint`, `no-unused-vars`, `no-console` | `pnpm lint` | ~10s |
| `Type check`, `tsc`, `Cannot find name`, `Type 'X' is not assignable` | `pnpm type-check` | ~20s |
| `Test`, `vitest`, `FAIL src/`, `expect(... ).toBe` | `pnpm test --run` | ~10-60s |
| `Build`, `next build`, `Module not found`, `Failed to compile` | `pnpm build` | ~60-120s |
| `Drizzle migration`, `migration failed`, `drizzle/` | `pnpm db:migrate:runtime` (로컬 DB 필요) | ~5s |
| `pnpm install`, `ERR_PNPM_OUTDATED_LOCKFILE`, `frozen-lockfile` | `pnpm install --frozen-lockfile` | ~30-60s |

여러 체크가 실패하면 매칭 명령을 모두 실행 (다만 build 는 lint/type-check 가 통과한 후에만 의미 — 순차 실행).

### 로컬 재현 결과 해석

각 명령 종료 후:

- **로컬 FAIL = CI 와 동일 재현** → CI 픽스 흐름 (다음 섹션) 으로 진행. 표의 "해결" 컬럼이 그대로 적용 가능
- **로컬 PASS = 로컬에서 재현 안 됨** → CI 환경 특수성. 가능 원인:
  - env vars 누락 (CI secrets / `.env.example` 대비 누락 항목)
  - Node 버전 / pnpm 버전 차이 (`.github/workflows/*.yml` 의 setup-node version 확인)
  - macOS 로컬 vs Linux CI 의 OS 차이 (BSD sed `\b` 같은 함정 — common-pitfalls 1-9)
  - actions/X@vN 의 floating tag 가 cutoff 이후 변경
  - 동시 실행으로 인한 race (DB / 파일시스템) — 보통 vitest 의 `--threads` 옵션

**자동 fix 금지** — 결과는 사용자에게 보고 후 의사결정 위임. AI 가 "lint 실패니까 자동 수정" 같은 판단으로 코드 변경하지 않는다. 단 사용자가 명시적으로 "그대로 적용해줘" 라고 하면 진행.

보고 형식:

```
로컬 재현 결과:

- pnpm lint: PASS (CI 와 불일치 — 환경 특수성 의심)
- pnpm type-check: FAIL (CI 와 동일 — src/foo.ts:42 'X' is not assignable)

권장:
- type-check 실패는 src/foo.ts:42 의 타입 가드 추가로 픽스 가능
- lint 의 CI-only 실패는 CI workflow 의 eslint 버전 / .eslintrc 차이 확인 필요
```
```

위 블록을 `### CI 실패 흔한 원인 → 해결 표` 섹션 *직후*, `### CI 픽스 흐름` 섹션 *직전* 에 그대로 삽입.

### 2. `.claude/skills/review-fix/SKILL.md` — "CI 픽스 흐름" 도입부 갱신

현재 (L68 부근):
```markdown
### CI 픽스 흐름

CI 실패 픽스는 리뷰 댓글 처리와 **동일한 단계** 를 따른다:
```

변경:
```markdown
### CI 픽스 흐름 (로컬 재현 결과 반영)

로컬 재현 단계 (위) 결과를 토대로 픽스 진행. 로컬 FAIL 이면 표의 "해결" 적용, 로컬 PASS + CI FAIL 이면 CI workflow 설정을 의심.
CI 실패 픽스는 리뷰 댓글 처리와 **동일한 단계** 를 따른다:
```

### 3. `.claude/skills/review-fix/SKILL.md` — "1단계" 의 상단 흐름도 갱신

현재 1단계 첫 문단 (L8 부근) 의 흐름:
```
CI 상태 먼저 확인 (필수) → CI 실패 로그 분석 → CI 픽스 흐름
```

변경 (로컬 재현 단계 명시):
```
CI 상태 먼저 확인 (필수) → CI 실패 로그 분석 → **로컬 재현 (사용자 confirm)** → CI 픽스 흐름
```

흐름도가 본문 어디에 있는지 grep 으로 확인 후 정확 위치에 삽입:

```bash
# cwd: <repo root>
grep -nE "CI 상태 먼저 확인.*로그 분석.*픽스 흐름|^### CI 상태 먼저 확인" .claude/skills/review-fix/SKILL.md
# 출력된 라인 근처를 갱신
```

(흐름도가 명시적으로 없다면 본 작업 항목 skip — 항목 1+2 만으로 충분)

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.claude/skills/review-fix/SKILL.md` | "로컬 재현" 신규 sub-섹션 + "CI 픽스 흐름" 도입부 갱신 + (있다면) 상단 흐름도 갱신 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan042-review-fix-ci-reproduce-impl (build-with-teams 자동 생성)

# 1. 신규 sub-섹션 마커 출현
grep -cE "^### CI 실패 → 로컬 재현" .claude/skills/review-fix/SKILL.md
# 기대: 1

# 2. AskUserQuestion 명시
grep -cE "AskUserQuestion" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 1 (본 신규 섹션 안)

# 3. 실패 체크 → 명령 매칭 표 모두 흡수 (6 행)
grep -cE "^\| .*pnpm (lint|type-check|test|build|db:migrate:runtime|install)" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 6

# 4. "자동 fix 금지" 가드 문구
grep -cE "자동 fix 금지" .claude/skills/review-fix/SKILL.md
# 기대: ≥ 1

# 5. "CI 픽스 흐름" 도입부 갱신
grep -nE "로컬 재현 결과 반영" .claude/skills/review-fix/SKILL.md
# 기대: 1건 출현

# 6. pnpm lint
pnpm lint
```

수동 smoke: 다음 PR 의 CI 실패 시점에 `/review-fix <N>` 호출 → 새 절차 동작 확인은 본 plan scope 외 — 다음 실제 CI 실패에서 자연 검증.

## 의도 메모 (왜)

- **사용자 confirm 우선**: 로컬 재현은 수십초~수분 소요. AI 자체 판단으로 실행하면 사용자 대기시간 폭증. confirm 으로 사용자가 시간 비용 인지
- **체크 매칭 (전체 X)**: lint 만 실패한 PR 에 `pnpm build` (~120s) 실행은 낭비. 실패한 체크에 1:1 매칭이 토큰 효율 (CLAUDE.md "토큰 효율" 원칙과 일관)
- **자동 fix 금지**: AI 가 lint 위반 "자동 수정" 같은 판단을 하면 사용자 의도 손상 위험. 보고 후 의사결정 위임 — plan041 과 동일 원칙 (가정하지 말고 묻기)
- **로컬 PASS + CI FAIL 진단 가이드**: CI-only 실패는 코드 fix 가 아닌 CI 설정 fix 필요. 가능 원인 5개 명시로 사용자가 다음 단계 판단 가능
