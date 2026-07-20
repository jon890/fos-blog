# Phase 03 — 통합 검증과 완료 상태 반영

**Execution profile**: fast
**Status**: pending

---

## 목표

issue #182의 폴더 검증과 동적 category 표시가 전체 품질 검사에서 함께 통과하는지 확인하고 task를 완료 상태로 전환한다.

**범위 외**: 기능 확장, 새 dependency, DB migration, docs 내용 변경.

---

## 작업 항목 (4)

### 1. category 동기화 집중 회귀

GitHub tree, 전체·증분 post sync, metadata sync, category meta와 아이콘 테스트를 한 번에 실행한다.
실제 폴더 허용, 미등록 오타 경고, 저장 유지, 자동 category 등록, 동적 label·색상을 모두 증명해야 한다.

### 2. 저장소 품질 검사

`pnpm lint`, `pnpm type-check`, 전체 `pnpm test`, `pnpm build`를 실행한다.
실패하면 원인을 고치고 관련 집중 테스트부터 다시 실행한 뒤 전체 검증을 반복한다.

### 3. 범위와 잔재 검사

다음을 확인한다.

- `SyncService`가 tree 순회나 category 판정을 직접 소유하지 않는다.
- category 표시 컴포넌트에 `toCanonicalCategory` 호출이 남지 않는다.
- 새 dependency, DB schema, migration, `/api/sync` 응답 변경이 없다.
- `RAW_TO_CANONICAL`은 선택적 legacy alias와 디자인 설정으로 남아 있으며 등록 필수 조건으로 쓰이지 않는다.

### 4. task 완료 상태 반영

모든 검증이 통과한 뒤 `tasks/plan055-github-folder-categories/index.json`의 최상위 `status`와 세 phase의 `status`를 `completed`로 변경한다.
각 phase 파일의 `Status`도 `completed`로 맞춘다.
이 상태 변경은 phase 03의 검증 관련 수정과 같은 단일 commit에 포함한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan055-github-folder-categories/index.json` | 전체·phase 완료 상태 |
| `tasks/plan055-github-folder-categories/phase-01.md` | 완료 상태 |
| `tasks/plan055-github-folder-categories/phase-02.md` | 완료 상태 |
| `tasks/plan055-github-folder-categories/phase-03.md` | 완료 상태 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog/.claude/worktrees/plan055-github-folder-categories
# branch: feat/plan055-github-folder-categories
pnpm test src/infra/github/api.test.ts src/services/PostSyncService.test.ts src/services/SyncService.test.ts src/services/MetadataSyncService.test.ts src/lib/category-meta.test.ts src/infra/db/constants.test.ts
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
! rg -n "toCanonicalCategory" src/components/PostCard.tsx src/components/CategoryCard.tsx src/components/CategoryFeatured.tsx src/components/SeriesCard.tsx src/components/ArticleHero.tsx
git diff --quiet origin/main...HEAD -- package.json pnpm-lock.yaml 'src/infra/db/schema/**' 'drizzle/**'
```

기대값:

- 모든 명령의 exit code가 0이다.
- 잔재 검사 출력이 0줄이다.
- `index.json`과 세 phase 파일의 상태가 모두 `completed`다.

## 의도 메모 (왜)

- GitHub API 경계, 서비스 orchestration, category 표시를 함께 바꾸므로 집중 테스트와 전체 build를 모두 통과해야 완료로 본다.
- task 상태는 구현·검증 완료 뒤에만 갱신해 계획과 실제 상태가 어긋나지 않게 한다.
