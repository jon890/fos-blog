# Task 생성 가이드

이 문서는 AI 에이전트가 fos-blog 의 구현 task 를 생성할 때 따르는 규칙이다. `/planning` 8단계 후 또는 단순 task 생성 시 참조.

## 디렉터리 구조

```
tasks/
  plan{N}-{kebab-slug}/
    index.json        # task 메타데이터 + phase 목록
    phase-01.md       # phase 1 프롬프트 (executor 에게 전달되는 실행 지시)
    phase-02.md
    ...
```

`plan{N}` 의 N 은 다음 가용 번호. 사전 확인:

```bash
# cwd: <repo root>
ls -dt tasks/plan*/ | head -5
```

## index.json 스키마

```jsonc
{
  "name": "plan{N}-{kebab-slug}",       // 디렉터리명과 일치
  "description": "한 줄 요약 — 무엇을 / 왜",
  "status": "pending",                    // pending | in_progress | completed | failed
  "created_at": "2026-04-28",             // YYYY-MM-DD
  "total_phases": 3,                      // phases 배열 길이와 일치
  "related_docs": [                       // (선택) 관련 docs 경로
    "docs/adr.md",
    "docs/code-architecture.md"
  ],
  "depends_on": [                         // (선택) 선행 plan 번호
    "plan009-design-tokens-foundation"
  ],
  "phases": [
    {
      "number": 1,
      "file": "phase-01.md",
      "title": "phase 제목 (간결)",
      "model": "sonnet",                  // haiku | sonnet | opus
      "status": "pending"
    }
  ]
}
```

### 검증 체크리스트

- [ ] `total_phases` == `phases` 배열 길이
- [ ] 모든 phase 에 `number` / `title` / `file` / `model` / `status` 존재
- [ ] `number` 가 1 부터 순차 증가
- [ ] 각 `file` 에 해당하는 `.md` 파일이 실제로 존재
- [ ] `name` 이 `tasks/{name}/` 디렉터리명과 일치

---

## Model 라우팅 (토큰 최적화)

CLAUDE.md "Agent Operating Rules" 의 Opus/Sonnet 라우팅 규칙 기반.

| 모델 | 용도 | 예시 |
|---|---|---|
| `haiku` | trivial 수정 / 빌드 검증 / 커밋 | grep / lint / pnpm build, dead code 정리, 마지막 phase 의 검증·커밋 |
| `sonnet` | 표준 구현 — 다중 파일 수정·rename·리팩토링·새 컴포넌트 | UI 컴포넌트, repository 메서드, route handler, 마이그레이션 SQL |
| `opus` | 새 아키텍처 설계 / 복잡 알고리즘 — phase 안에 신규 도메인 핵심 설계가 있을 때만 | 새 추상화 레이어 도입, AI 파이프라인 설계 |

**기계적 작업은 opus 금지**. rename / 이동 / 경로 수정은 파일 수가 많아도 sonnet 으로 충분.

---

## phase 파일 작성 규칙

### 핵심 원칙

1. **자기완결적** — 각 phase 프롬프트는 이전 대화 컨텍스트 없이 독립 실행. 필요한 모든 맥락을 프롬프트 안에 포함
2. **단일 책임** — 한 phase 는 명확히 하나의 작업 단위. 작업 항목 5개 이하
3. **검증 가능** — phase 마지막에 실행 가능한 성공 기준 명시 (grep / test / build)

### phase 파일 구조

```markdown
# Phase NN — {제목}

**Model**: sonnet
**Status**: pending

---

## 목표

이 phase 에서 구현해야 할 것을 명확히 기술. 왜 필요한지 한 문장.

**범위 외**: 다른 phase 또는 다른 plan 의 책임을 명시 (혼동 방지).

---

## 작업 항목 (N)

### 1. {파일/모듈} — 변경 요약

구체적 변경 — 함수 시그니처, props 타입, 셀렉터, 토큰 이름 등.
기존 패턴 참조: `src/...` 의 동일 패턴.

### 2. ...

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/...` | 신규 / 수정 / 삭제 |

## 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run

# 구체적 grep / test 기준
grep -n "expected-pattern" src/some/file.ts
! grep -nE "legacy-pattern" src/  # exit 1 이어야 함
```

수동 smoke (`pnpm dev`):
- `/route` — 어떤 동작 확인
- 다크/라이트 모드 토글

## 의도 메모 (왜)

- 결정 X 의 근거 — 다른 옵션을 기각한 이유
- 향후 이 phase 가 다음 plan 의 어떤 부분을 막아주는가

## Blocked 조건 (선택)

- DB / 외부 의존성 부재 → `PHASE_BLOCKED: {이유}` 출력 후 종료
```

### phase 작성 시 self-check

- [ ] 자기완결 — 이전 phase 대화 없이 읽어도 무엇을 해야 할지 명확
- [ ] 작업 항목 5개 이하 (CLAUDE.md "Task 작업 규칙")
- [ ] 함수/컴포넌트의 이름·파라미터·반환 타입이 구체적
- [ ] 이전 phase 산출물 참조 시 경로 명시
- [ ] 성공 기준에 실행 가능한 명령 + 기대값 (`! grep`, `wc -l`, `exit=0` 등) 명시
- [ ] `common-pitfalls.md § 1` 패턴 모두 소진

---

## fos-blog 레이어별 phase 가이드

CLAUDE.md "Architecture" 의 레이어 (app → services → infra, lib 는 횡단) 기준.

| 작업 유형 | 권장 phase 분해 |
|---|---|
| 신규 페이지 (UI) | ① 컴포넌트 신규 (`src/components/`) ② 페이지 통합 (`src/app/`) ③ 검증 |
| 신규 API 라우트 | ① service 메서드 (`src/services/`) ② route handler (`src/app/api/`) ③ 검증 |
| DB 스키마 변경 | ① schema 수정 (`src/infra/db/schema/`) + `pnpm db:generate` ② repository 메서드 ③ 검증 (`pnpm db:migrate:runtime` 로 로컬 적용 확인) |
| 마이그레이션 / GitHub 동기화 변경 | ① `src/infra/github/` 또는 `src/services/SyncService.ts` ② 영향 받는 호출자 ③ 검증 + idempotency 테스트 |
| 디자인 토큰 / 스타일 | ① `src/app/globals.css` 토큰 추가 ② 컴포넌트 토큰 적용 ③ legacy 잔재 grep + Lighthouse |

---

## 마지막 phase 표준 (권장)

소규모 plan (1~2 phase) 은 검증을 본 phase 에 흡수. 중규모 이상 (3+ phase) 은 마지막 phase 를 검증 전용으로 분리:

| Phase | 제목 | 모델 | 내용 |
|---|---|---|---|
| 마지막 | 통합 검증 + legacy 잔재 grep | `haiku` | `pnpm lint && pnpm type-check && pnpm build && pnpm test`, 잔재 grep, dead code 정리, JSON-LD 회귀, Lighthouse smoke |

**커밋은 별도 phase 로 분리하지 않는다** — fos-blog 는 build-with-teams 가 phase 단위로 atomic commit 자동 생성. 사용자가 PR 머지 시 squash 가능.

마지막 phase 에 **`index.json` 의 status="completed" 마킹** 명시 — `common-pitfalls.md` 시드 패턴.

---

## Phase 묶기 vs 분리 기준

**묶기**:
- 동일 UI 패턴 복제 (예: 같은 카드 컴포넌트를 다른 페이지에 적용)
- 동일 스키마 확장 (예: 같은 테이블에 컬럼 여러 개 추가)
- 동일 기능의 다른 영역 확장

**별도 phase 로 분리**:
- 서로 다른 도메인 (예: UI 변경 vs DB 스키마 변경)
- 독립 실행 가능 + 의존 관계 없음 — 한 쪽이 실패해도 다른 쪽 진행 가능
- 검증 단위가 다름 (예: 컴포넌트 단위 grep vs Lighthouse 점수)

---

## 별도 plan 으로 분리 vs 같은 plan 의 phase 분리

같은 plan 의 phase: 의존성 있음 (phase 1 산출물을 phase 2 가 사용). PR 1개로 묶임.

별도 plan: 독립 실행 가능, PR 분리. 다음 기준일 때 별도 plan:
- 사용자 검토 시점이 분리되어야 함 (예: 디자인 mockup 도착 vs 도착 전 작업)
- 한 쪽이 다른 쪽 머지 후에 시작해야 함 (의존성)
- 도메인이 분리됨 — 한 쪽이 실패해도 다른 쪽은 진행

`plan-2`, `plan-3` 같은 sub-numbering 은 동일 영역의 follow-up 일 때 (예: `plan013-2-footer-redesign` 은 plan013 후속).

---

## 참조

- `common-pitfalls.md § 1 plan 작성` — critic 회피 패턴 모두 소진
- `CLAUDE.md` "Task 작업 규칙" — atomic phase, 5개 이하 작업, 자기완결 프롬프트, task 파일 즉시 commit
- `CLAUDE.md` "DB 스키마 변경 규칙" — `pnpm db:push` 프로덕션 금지, `db:generate` + 마이그레이션 SQL 커밋
