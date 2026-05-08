# Phase 05 — 검증 + docs-check 재실행 + index.json 마킹

**Model**: haiku

## 작업 항목

### 1. 통합 검증

docs-only plan 이라 빌드/테스트 영향 없음. 그래도 회귀 방지:

```bash
# cwd: <worktree root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

모두 PASS 여야 함.

### 2. docs-check 재실행 (5축 게이트)

`fos-blog-docs-verifier` agent 호출하여 본 plan 변경 후 docs 상태 재검증:

```
Agent({
  subagent_type: "fos-blog-docs-verifier",
  description: "post-plan036 docs audit",
  prompt: "plan036 적용 후 전체 docs 5축 재점검. ADR Index sync / page docs 정합 / Drizzle schema 정합 / ADR bloat 0건 / 매트릭스 용어 0건 / 홈서버 가드 통과 모두 확인. 신규 발견 항목만 리포트."
})
```

기대 결과 (모두 PASS):
- A 부패: ADR Index sync / page.tsx ↔ docs/pages 정합 / Drizzle schema sync 모두 통과
- B 과대화: ADR-017 / ADR-018 30줄 이하
- C 추론성: 신규 작성 docs 모두 결정/맥락/대안 3구조
- D 중복: 신규 docs 가 단일 소스 원칙 준수
- E 자명성: 본 plan 은 ADR 신규 추가 없음 (ADR-017/018 슬리밍만) — 변경 없음

### 3. issue close

해당 issue 가 있다면 PR body 에 `Closes #<issue>` 명시 (audit 자체는 issue 로 트래킹되지 않으므로 없을 가능성 높음).

### 4. index.json status 마킹

phase 1/2/3/4/5 + 최상위 `status` = `"completed"` (총 6개 "completed" 토큰).

### 5. verification

```bash
grep -c '"completed"' tasks/plan036-docs-check-followup/index.json
# 출력: 6 (top + phase 1/2/3/4/5)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `tasks/plan036-docs-check-followup/index.json` | 수정 (status 6 곳 모두 completed) |

## Out of Scope

- 본 plan 외 docs 변경
- 신규 audit 발견 항목 (다음 plan 으로 follow-up)
