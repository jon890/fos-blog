# Phase 02 — 저장된 요약 값 보정과 전체 검증

**Execution profile**: standard
**Status**: completed

---

## 목표

phase 01이 바꾼 추출 규칙이 `posts.description`에 저장된 값에도 반영되도록 파생 필드 보정 경로를 넓힌다.

`src/services/PostSyncService.ts`의 동기화는 `existing?.sha === file.sha`면 파일을 건너뛴다.
콘텐츠 저장소의 마크다운은 그대로이므로 추출 함수만 고치면 저장된 요약은 옛 값으로 남는다.
인기 글 행 목록, 시리즈 카드, 검색 대화상자 결과, RSS가 이 저장 값을 쓴다.

같은 파일에 이미 `retitleAll()`이 있다.
저장된 본문에서 제목을 매번 다시 계산해 보정하는 함수이고 `src/services/SyncService.ts`가 동기화 경로 양쪽에서 호출한다.
이 순회에 요약 보정을 합친다.

**범위 외**: 추출 규칙 자체(phase 01 책임), DB 스키마와 마이그레이션(변경 없음), 소비처 화면 수정, 문서 수정(이미 완료).

---

## 작업 항목 (3)

### 1. 파생 필드 보정 함수로 확장

`src/services/PostSyncService.ts`의 `retitleAll()`을 `refreshDerivedFields()`로 바꾼다.

전체 글을 한 번만 순회하면서 저장된 `content`로 제목과 요약을 다시 계산한다.
본문을 두 번 읽지 않으려고 순회를 합치는 것이므로 `getAllWithContent()` 호출은 한 번만 남긴다.
`src/infra/db/repositories/PostRepository.ts`의 `getAllWithContent()`가 저장된 `description`도 조회해 반환하도록 확장한다.

각 글에서 계산한 값이 저장된 값과 다를 때만 갱신하고, 제목과 요약 중 달라진 필드만 `update`에 담는다.
둘 다 같으면 건너뛴다.
요약은 `extractDescription(content, 200)`으로 계산해 `upsert`와 같은 길이 기준을 쓴다.

반환 타입은 다음과 같다.

```ts
{
  total: number;
  titles: { updated: number; skipped: number };
  descriptions: { updated: number; skipped: number };
}
```

`content`가 없는 글은 두 통계 모두에서 `skipped`로 센다.

### 2. 호출부와 응답 형태 연결

`src/services/SyncService.ts`의 `PostSync` 타입에서 `retitleAll`을 `refreshDerivedFields`로 바꾼다.
호출 지점은 두 곳이다. 이미 최신 상태인 경로와 변경이 있는 경로 모두에서 호출한다.

`SyncResult`의 기존 `titles` 필드는 형태를 유지한다.
`{ total, updated, skipped }` 형태를 보정 결과에서 조립해 채우고, 같은 방식으로 `descriptions` 필드를 추가한다.
기존 응답을 읽는 쪽이 깨지지 않게 하려는 것이다.

`src/app/api/sync/route.ts`는 응답 필드를 하나씩 나열해 넘긴다.
`titles: syncResult.titles` 옆에 `descriptions: syncResult.descriptions`를 추가한다.

### 3. 회귀 테스트 갱신

`src/services/PostSyncService.test.ts`의 `retitleAll` 테스트를 새 함수 이름으로 옮기고 다음을 고정한다.

- 저장된 제목과 계산된 제목이 다르면 제목만 갱신한다.
- 저장된 요약과 계산된 요약이 다르면 요약만 갱신한다.
- 둘 다 다르면 한 번의 `update`로 두 필드를 함께 넘긴다.
- 둘 다 같으면 `update`를 호출하지 않는다.
- `content`가 없는 글은 갱신하지 않는다.
- 전체 글을 한 번만 조회한다.
- `syncAll`과 `syncChanged`의 기존 결과 기대값도 `descriptions`가 포함된 새 반환 형태로 갱신한다.

`src/services/SyncService.test.ts`에서 `retitleAll` 모의 구현과 호출 검증을 새 이름과 새 반환 형태로 바꾼다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/infra/db/repositories/PostRepository.ts` | `getAllWithContent()`가 저장된 요약도 반환하도록 확장 |
| `src/services/PostSyncService.ts` | `retitleAll` → `refreshDerivedFields` 확장 |
| `src/services/SyncService.ts` | 호출 이름과 `SyncResult` 필드 조립 |
| `src/app/api/sync/route.ts` | 동기화 응답에 `descriptions` 추가 |
| `src/services/PostSyncService.test.ts` | 보정 동작 회귀 테스트 갱신 |
| `src/services/SyncService.test.ts` | 모의 구현과 호출 검증 갱신 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/services/PostSyncService.test.ts src/services/SyncService.test.ts src/lib/markdown.test.ts
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

기대값: 위 명령이 모두 종료 코드 0이다.

```bash
# cwd: /Users/nhn/personal/fos-blog
rg -n "retitleAll" src
```

기대값: 출력이 없고 종료 코드 1이다. 옛 이름이 남아 있지 않다.

검증이 모두 통과하면 `tasks/plan058-description-extraction/index.json`의 최상위 `status`와 두 phase의 `status`를 `completed`로 변경한다.

## 의도 메모 (왜)

- 일회성 보정 스크립트 대신 동기화 경로에 합친 이유는 추출 규칙이 앞으로 또 바뀌어도 같은 문제가 반복되지 않게 하기 위해서다. `retitleAll`이 이미 같은 이유로 존재한다.
- 보정 함수를 따로 하나 더 만들지 않은 이유는 401개 글의 본문을 두 번 읽게 되기 때문이다. 값이 달라진 글만 갱신하므로 최초 1회 이후에는 쓰기가 발생하지 않는다.
- `SyncResult.titles`를 그대로 둔 이유는 동기화 응답을 읽는 쪽의 기존 형태를 깨지 않기 위해서다.
- 추출 규칙 변경과 저장 값 반영은 함께 검토해야 결과를 확인할 수 있어 하나의 PR로 묶는다.
