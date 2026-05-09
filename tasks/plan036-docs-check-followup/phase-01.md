# Phase 01 — ADR-022/023/024 Index + anchor 정리

**Model**: haiku
**Goal**: ADR 본문에 있으나 상단 Index 미등재 + anchor 누락된 3개 ADR 정리.

## Context (자기완결)

`docs/adr.md` 본문에 `## ADR-022`, `## ADR-023`, `## ADR-024` 헤더가 있지만:
- 상단 ADR Index 섹션에 링크 부재 → grep 으로 빠른 탐색 불가
- 헤더 직전 `<a id="adr-XXX"></a>` anchor 부재 → Index 링크 클릭해도 이동 안 됨

기존 ADR-001~021 은 anchor 정상. ADR-022~024 만 누락.

ADR 별 한 줄 제목 (검증된 audit 결과):
- ADR-022: About 페이지 — co-located CSS + 2-stage avatar (plan023)
- ADR-023: 태그 시스템 — `posts.tags JSON` + `JSON_CONTAINS` (plan026)
- ADR-024: RSS feed — RSS 2.0 + `pubDate=createdAt` + 50 limit (plan027)

## 작업 항목

### 1. ADR-022/023/024 헤더 직전에 anchor 추가

`docs/adr.md` 의 `## ADR-022.` / `## ADR-023.` / `## ADR-024.` 헤더 직전에 빈 줄 + `<a id="adr-022"></a>` 형식으로 anchor 추가. 기존 ADR-021 까지의 패턴 동일.

### 2. ADR Index 섹션에 3개 링크 추가

`docs/adr.md` 상단 Index 섹션의 적절한 카테고리 (또는 신규 카테고리) 에 다음 3줄 추가:

```markdown
- [ADR-022](#adr-022) — About 페이지 co-located CSS + 2-stage avatar
- [ADR-023](#adr-023) — 태그 시스템 (posts.tags JSON + JSON_CONTAINS)
- [ADR-024](#adr-024) — RSS feed (RSS 2.0 + pubDate=createdAt)
```

기존 Index 카테고리 구조를 grep 으로 먼저 확인 후 (`grep -n "^### \|^## ADR Index" docs/adr.md`) 자연스러운 위치에 삽입.

### 3. 자동 verification (bash 3.2 호환)

```bash
# cwd: <worktree root>

# Index sync 검증
BODY=$(grep -oE '^## ADR-[0-9]+' docs/adr.md | grep -oE 'ADR-[0-9]+' | sort -u)
INDEX=$(grep -oE '\[ADR-[0-9]+\]\(#adr-[0-9]+\)' docs/adr.md | grep -oE 'ADR-[0-9]+' | sort -u)
diff <(echo "$BODY") <(echo "$INDEX") && echo "OK: ADR Index synced"

# anchor 검증
for n in $BODY; do
  lower=$(echo "$n" | tr '[:upper:]' '[:lower:]')
  grep -B 1 "^## $n\." docs/adr.md | grep -q "<a id=\"$lower\"" \
    || echo "MISSING anchor: $n"
done

# ADR-012 결번 정상 (본문에 없음 + Index 에도 없음)
grep -q "^## ADR-012" docs/adr.md && echo "FAIL: ADR-012 결번 위반" || echo "OK: ADR-012 결번 보존"
```

verification 출력에 "OK: ADR Index synced" + "MISSING anchor" 0건 + "OK: ADR-012 결번 보존" 모두 보여야 통과.

## Critical Files

| 파일 | 상태 |
|---|---|
| `docs/adr.md` | 수정 (Index 3 링크 추가 + anchor 3 추가) |

## Out of Scope

- ADR 본문 내용 수정 (phase-04 의 슬리밍에서 처리)
- 다른 ADR 의 Index 재정렬 / 재분류
- ADR-012 결번 처리 (이미 결번, 재할당 금지 규칙 적용 — 작업 불필요)

## Risks

| 리스크 | 완화 |
|---|---|
| Index 의 카테고리 분류 모호 | 기존 ADR-021 의 Index 위치 + 카테고리 명 grep 후 동일 카테고리에 추가 |
| anchor 형식이 ADR 별 다를 가능성 | ADR-021 의 실제 anchor 라인을 grep 으로 추출 후 동일 형식 사용 |
