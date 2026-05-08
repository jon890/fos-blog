# Phase 04 — ADR-017 / ADR-018 슬리밍 (30줄 이하)

**Model**: sonnet
**Goal**: bloat 자동 검출에서 30줄 초과 잡힌 2개 ADR 을 결정/맥락/대안 3구조로 응축.

## Context (자기완결)

audit 결과 — 강화된 docs-check 의 30줄 BLOAT 검출이 다음 2개 ADR 잡음:

- **ADR-017** (44줄, `<a id="adr-017">` anchor 로 정확히 찾을 것): plan013 + plan013-2 추가 결정 누적 (SiteFooter 분리 / span aria-disabled 패턴 / BUILD_DATE 하드코딩 등). 디자인 시스템 핵심 결정 외 plan별 후속 메모가 본문에 누적.
- **ADR-018** (35줄, `<a id="adr-018">` anchor 로 정확히 찾을 것): Consequences 섹션의 Dockerfile 변경 내역 + Follow-ups 의 분산 락 검토 메모. Consequences 는 코드로 자명, Follow-ups 는 issue/backlog 성격.

## 작업 항목

### 1. ADR-017 슬리밍

다음 4단계로 압축:

1. 현재 본문 Read (`docs/adr.md` 의 ADR-017 섹션 — `<a id="adr-017">` anchor 로 위치 식별) 후 핵심 결정 식별
2. plan013 / plan013-2 추가 결정 중 **재현 가능한 의사결정 의도**만 보존 — 구현 결과(컴포넌트 파일명, props 시그니처) 제거
3. 코드로 자명한 부분 (예: BUILD_DATE 하드코딩 위치) 제거 — 코드 grep 으로 충분
4. 30줄 이하로 응축된 ADR-017 작성. 결정 / 맥락 / 대안 기각 3구조 명시

### 2. ADR-018 슬리밍

1. 현재 본문 Read 후 핵심 결정 식별 (drizzle migrator 컨테이너 인라인 + CMD 교체)
2. Consequences 섹션의 Dockerfile 변경 내역 제거 — git log 로 자명
3. Follow-ups 의 분산 락 검토 메모는 별도 issue 로 옮길지, 본문에서 한 줄로 응축할지 판단 (기본: 한 줄로 응축, 자세한 검토는 별도 plan)
4. 30줄 이하로 응축

### 3. 슬리밍 시 보존 원칙

- **결정 / 맥락 / 대안 기각 3 요소** 모두 보존 (추론성 게이트)
- **의사결정 의도** 보존 — "왜 X 가 아닌 Y 인가" 1-2 문장
- **plan 번호 trace** 보존 — 어떤 plan 에서 결정된 것인지 1줄
- **구현 세부사항 제거** — 컴포넌트 / props / 파일 경로 / 코드 스니펫
- **인덱스 동기화** 영향 없음 — Index 링크 / anchor 그대로

### 4. 자동 verification (slimming 후 BLOAT 0건)

```bash
# cwd: <worktree root>

# 슬리밍 후 30줄 초과 없어야 함 (BLOAT 출력 0줄)
SEP_COUNT=$(grep -cE "^---$" docs/adr.md)
ADR_COUNT=$(grep -cE "^<a id=\"adr-" docs/adr.md)
if [ "$SEP_COUNT" -ne "$ADR_COUNT" ]; then
  echo "WARN: 구분선 ($SEP_COUNT) ≠ ADR ($ADR_COUNT)"
fi
for n in $(grep -oE '^## ADR-[0-9]+' docs/adr.md | grep -oE '[0-9]+'); do
  size=$(awk "/<a id=\"adr-$n\"/,/^---$/" docs/adr.md | wc -l | tr -d ' ')
  [ "$size" -gt 30 ] && echo "BLOAT: ADR-$n ($size lines)"
done
# 위 출력에 BLOAT 0줄이어야 PASS

# 추론성 게이트 (이유/맥락 + 대안 키워드)
for n in 017 018; do
  body=$(awk "/<a id=\"adr-$n\"/,/^---$/" docs/adr.md)
  echo "$body" | grep -cE "이유|맥락|왜|근거|Context" >/dev/null && echo "ADR-$n: 이유 OK" || echo "ADR-$n: 이유 누락"
  echo "$body" | grep -cE "대안|기각|반려|Why|Alternative" >/dev/null && echo "ADR-$n: 대안 OK" || echo "ADR-$n: 대안 누락"
done
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `docs/adr.md` | 수정 (ADR-017 / ADR-018 본문 슬리밍, anchor / Index 링크 그대로) |

## Out of Scope

- 다른 ADR 의 bloat 검사 (audit 에서 30줄 이하로 통과)
- ADR 본문 의사결정 변경 (의도 보존, 표현만 응축)
- ADR Index 재정렬

## Risks

| 리스크 | 완화 |
|---|---|
| 슬리밍 과정에서 의사결정 의도 유실 | 결정 / 맥락 / 대안 3 구조 + plan 번호 trace 보존 강제 |
| ADR-017 의 plan013/plan013-2 추가 결정이 정말로 별 ADR 적격일 가능성 | "별 ADR 분리" 검토 — 단 본 phase scope 외, 우선 ADR-017 본문에서 응축. 별 ADR 필요 시 후속 plan |
| ADR-018 Follow-ups (분산 락) 가 issue 로 이동 필요 | 본 phase 에서는 한 줄 응축만. 실제 이슈 등록은 별도 작업 |
