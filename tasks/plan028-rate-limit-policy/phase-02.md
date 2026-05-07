# Phase 02 — 검증 + ADR-016 갱신 + 마킹

**Model**: haiku
**Goal**: phase 1 결과 통합 검증 + ADR-016 (Rate limit 정책) 갱신 + index.json 마킹.

## 작업 항목

### 1. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

오류 0건. 있으면 phase 1 로 돌려 수정.

### 2. `docs/adr.md` ADR-016 갱신

기존 ADR-016 (Rate limit 정책) 본문 끝에 한 단락 추가 — `/api/sync` 만 제외, 나머지는 일반 한도 적용 결정. 트레이드오프 (option C/D 기각 사유) 1~2줄.

새 ADR 번호 부여 X — 기존 ADR-016 의 후속 결정이라 본문 갱신.

### 3. issue close 코멘트

PR merge 후 자동 close 되도록 PR body 에 `Closes #113` `Closes #82` 작성. 또는 이미 plan028 PR 에 명시되어 있으면 별도 작업 없음.

### 4. index.json status 마킹

`tasks/plan028-rate-limit-policy/index.json` 의 phase 1/2 + 최상위 `status` = `"completed"`.

### 5. verification

```bash
grep -n "api/sync" docs/adr.md         # ADR-016 갱신 확인
grep -n "\"completed\"" tasks/plan028-rate-limit-policy/index.json | wc -l  # 3
```
