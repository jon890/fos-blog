# Phase 06 — 통합 검증과 완료 상태 반영

**Execution profile**: fast
**Status**: pending

---

## 목표

plan054의 schema, sync, matcher, renderer, 페이지 계약을 통합 검증하고 task 상태를 완료로 반영한다.

**범위 외**: 기능 확장, 초기 용어 작성, `fos-study` 배포.

## 작업 항목 (4)

### 1. glossary 원본 계약 fixture

테스트 fixture에 유효한 `version: 1`, `SLA`, 별칭, reference를 포함한다.
다음 실패 fixture도 유지한다.

- 중복 id
- 대표 용어와 별칭 충돌
- `http` reference
- 파일 누락
- 명시적 `terms: []`

실제 운영 전에는 별도 `fos-study` commit으로 루트 `glossary.json`을 먼저 추가해야 한다.
해당 파일이 없으면 배포하지 않는다는 조건을 최종 보고에 남긴다.

### 2. 불변식 잔재 검사

다음을 검사한다.

- `SyncService`에 post traversal이 남지 않는다.
- renderer와 mention scanner가 공용 matcher를 import한다.
- glossary page description은 tooltip을 비활성화한다.
- Header에는 glossary link가 없고 Footer·sitemap에는 있다.
- app의 신규 glossary import가 infra를 직접 참조하지 않는다.
- migration이 git 추적 대상이다.

### 3. 품질 검증

targeted test 다음에 lint, type-check, build, test를 실행한다.
build에는 필수 `GITHUB_TOKEN`, `SYNC_API_KEY`, `DATABASE_URL` 검증 환경을 사용한다.

### 4. task 완료 상태 반영

검증이 모두 통과한 뒤 `tasks/plan054-glossary-tooltip/index.json`의 root status와 phase 1~6 status를 `completed`로 바꾼다.
이 상태 변경은 phase 06 구현 commit에 함께 포함하며 별도 commit으로 분리하지 않는다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan054-glossary-tooltip/index.json` | root와 phase 상태를 `completed`로 변경 |
| `src/services/GlossarySyncService.test.ts` | 원본 계약 fixture 최종 점검 |
| `drizzle/<next>_*.sql` | 생성 migration 추적 확인 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan054-glossary-tooltip
# branch: feat/plan054-glossary-tooltip
pnpm test --run src/lib/glossary-matcher.test.ts src/services/glossary-mention-scanner.test.ts src/services/GlossarySyncService.test.ts src/components/markdown/glossary-transform.test.ts src/components/glossary/GlossaryTooltip.test.tsx src/components/glossary/GlossaryIndex.test.tsx
pnpm lint
pnpm type-check
GITHUB_TOKEN=dummy SYNC_API_KEY=dummy DATABASE_URL=mysql://user:pass@127.0.0.1:3306/fos_blog pnpm build
pnpm test
! rg -n "collectMarkdownFiles|performFullSync|performIncrementalSync" src/services/SyncService.ts
rg -n "glossary-matcher" src/components/markdown/glossary-transform.ts src/services/glossary-mention-scanner.ts
rg -n 'enableGlossary=\{false\}' src/app/glossary/page.tsx src/components/glossary
! rg -n 'href: "/glossary"' src/components/Header.tsx
rg -n 'href: "/glossary"|/glossary' src/components/SiteFooter.tsx src/app/sitemap.ts
MIGRATION=$(rg -l "CREATE TABLE.*glossary_terms" drizzle/*.sql)
test "$(printf '%s\n' "$MIGRATION" | sed '/^$/d' | wc -l | tr -d ' ')" -eq 1
git ls-files --error-unmatch "$MIGRATION"
grep -c '"status": "completed"' tasks/plan054-glossary-tooltip/index.json
```

기대값:

- targeted test, lint, type-check, build, test exit code가 0이다.
- SyncService 잔재와 Header link `rg` 출력은 0줄이다.
- 공용 matcher, glossary 비활성화, Footer·sitemap, migration 명령은 각각 1줄 이상 출력한다.
- completed status 개수는 7이다.

## Blocked 조건

- migration을 로컬 MySQL에 적용해 검증할 수 없으면 생성 SQL 정적 검사 결과와 미실행 이유를 보고한다.
- `fos-study/glossary.json`이 준비되지 않았으면 애플리케이션 구현은 완료할 수 있지만 production 배포는 `PHASE_BLOCKED: fos-study glossary 원본 미준비`로 구분한다.

## 의도 메모 (왜)

- 원본 콘텐츠 commit과 애플리케이션 commit은 서로 다른 repository이므로 원자 commit으로 섞지 않는다.
- 초기 `glossary.json`을 먼저 배포해야 ADR-032의 누락 실패 정책과 충돌하지 않는다.
- 마지막 phase가 `index.json` 완료 상태를 소유해 구현과 task metadata가 어긋나지 않게 한다.
