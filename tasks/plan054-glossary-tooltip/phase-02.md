# Phase 02 — 용어 정의 schema와 안전한 동기화

**Execution profile**: standard
**Status**: pending

---

## 목표

`fos-study/glossary.json`을 검증해 DB에 원자적으로 반영하고 누락·오류 시 마지막 정상 데이터를 보존한다.

**범위 외**: 언급 페이지 계산, Markdown 툴팁, 공개 페이지 UI.

## 작업 항목 (5)

### 1. Drizzle schema와 migration

`src/infra/db/schema/glossaryTerms.ts`와 `src/infra/db/schema/glossaryMentions.ts`를 `docs/data-schema.md` 계약대로 추가한다.
`glossary_mentions.term_id`는 `glossary_terms.id`를 참조하고 용어 삭제 시 cascade한다.

schema index와 repository factory export를 갱신한 뒤 `pnpm db:generate`로 migration을 생성한다.
생성 SQL을 읽어 PK, FK, unique, index, JSON default가 의도와 일치하는지 명령 기반으로 검증한다.
SQL을 직접 편집하지 않는다.

### 2. `glossary.json` Zod 계약

`src/services/glossary-schema.ts`에 `version: 1`과 `terms` 배열 schema를 정의한다.

필수 필드:

- `id`: 소문자 kebab-case, 최대 128자
- `term`: 2~255자
- `summary`: 비어 있지 않은 plain text
- `description`: 비어 있지 않은 Markdown string

선택 필드:

- `fullName`
- `aliases`: 기본 `[]`
- `caseSensitive`: 기본 `false`
- `references`: `{ label, url }[]`, `https`만 허용

parse 후 파일 단위 검증에서 `id`, 대표 용어, 별칭의 중복과 다른 개념 간 충돌을 거부한다.
표현 충돌은 `caseSensitive` 설정과 무관하게 case-folding한 값도 비교해 matcher가 둘 이상의 개념으로 해석할 입력을 허용하지 않는다.

### 3. `GlossaryRepository` — 정의 원자 교체

`replaceTerms(terms)`는 한 transaction에서 upsert와 원본에 없는 용어 삭제를 수행한다.
빈 배열은 명시적 delete-all 분기로 처리하고 `notInArray(column, [])`를 호출하지 않는다.
읽기 메서드는 matcher용 경량 projection과 page용 definition projection을 구분한다.

### 4. `GlossarySyncService` — 원본 안전 정책

고정 경로 `glossary.json`을 사용한다.

- full mode는 파일을 fetch하고 검증한다.
- incremental mode는 변경 목록에 `glossary.json`이 있을 때만 fetch한다.
- removed·renamed-away·404·JSON parse·Zod 실패는 기존 DB를 건드리지 않고 error를 throw한다.
- 유효한 `terms: []`는 정의와 cascade mention을 비운다.
- 성공 결과는 `{ definitionsChanged, terms }`를 반환한다.

정의 단계 메서드는 `syncDefinitions(mode, changedFiles)`로 분리한다.
mention 계산은 phase 03에서 별도 `syncMentions(...)`로 추가하며 이 메서드 안에서 실행하지 않는다.

### 5. orchestration과 API 결과 확장

`SyncService`가 `syncDefinitions()`를 post·metadata 처리 전에 호출한다.
phase 03이 추가할 mention 갱신은 post·metadata 저장이 끝난 뒤 호출하도록 orchestration 위치를 비워 둔다.
기존 응답 필드를 유지하면서 `glossary` 객체에 `definitionsChanged`, `terms`, 초기값 0인 `mentions`, `pagesReindexed`를 추가한다.
`src/app/api/sync/route.ts`는 해당 객체를 additive field로 반환한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/schema/glossaryTerms.ts` | 신규 정의 table |
| `src/infra/db/schema/glossaryMentions.ts` | 신규 역참조 table |
| `src/infra/db/schema/index.ts` | schema export |
| `src/infra/db/repositories/GlossaryRepository.ts` | 신규 repository |
| `src/infra/db/repositories/index.ts` | factory와 export 갱신 |
| `src/services/glossary-schema.ts` | 신규 JSON 검증 계약 |
| `src/services/GlossarySyncService.ts` | 신규 정의 동기화 |
| `src/services/SyncService.ts` | glossary orchestration |
| `src/services/index.ts` | 생성 wiring |
| `src/app/api/sync/route.ts` | additive glossary 결과 |
| `drizzle/<next>_*.sql` | `db:generate`가 정한 다음 번호의 산출물 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan054-glossary-tooltip
# branch: feat/plan054-glossary-tooltip
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/fos_blog pnpm db:generate
pnpm test --run src/services/GlossarySyncService.test.ts src/infra/db/repositories/GlossaryRepository.test.ts src/services/SyncService.test.ts
pnpm type-check
MIGRATION=$(git diff --name-only --diff-filter=A -- 'drizzle/*.sql')
test "$(printf '%s\n' "$MIGRATION" | sed '/^$/d' | wc -l | tr -d ' ')" -eq 1
rg -n "CREATE TABLE.*glossary_terms|CREATE TABLE.*glossary_mentions|FOREIGN KEY|UNIQUE" "$MIGRATION"
```

기대값:

- migration 생성, 테스트, type-check exit code가 0이다.
- 신규 migration 목록이 1개이며 마지막 `rg`가 두 table 생성과 FK·unique 제약을 출력한다.

## Blocked 조건

- `pnpm db:generate`가 기존 schema drift 또는 interactive prompt로 종료되면 SQL을 직접 만들지 않는다.
- `PHASE_BLOCKED: db:generate가 비대화식 migration을 생성하지 못함`을 보고한다.

## 의도 메모 (왜)

- ADR-032의 누락 보존 정책은 데이터 삭제를 명시적 빈 배열로만 허용한다.
- `package.json` 변경은 없으며 신규 dependency를 추가하지 않는다.
- schema와 생성 migration은 같은 phase commit에 포함한다.
