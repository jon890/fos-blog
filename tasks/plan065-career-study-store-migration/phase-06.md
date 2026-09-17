# Phase 06. 책임 문서와 회귀 검증 마감

**Execution profile**: standard

## 목표

문서가 새 데이터 소유권과 fos-blog의 Backend client 경계를 설명하게 고치고,
공개 블로그 회귀가 없는지 검증한 뒤 이전 기준 문서를 정리한다.

**범위 외**: career-os Backend의 내부 스키마 최적화와 학습자료 화면 재설계는 포함하지 않는다.

## 컨텍스트

이 phase는 코드와 migration이 실제로 제거된 뒤 수행한다.
계획 문서를 완료로 표시하기 전에 기존 책임 문서가 로컬 study API와 MySQL 소유권을 현재 동작으로 설명하지 않는지 확인한다.

`docs/api/study-library.md`는 지금 두 저장소가 공유하는 HTTP 계약의 단일 소스이고
`## 인증 계약`, `## 소비측 호환 기준` 등 13개 절을 가진다.
이 문서는 다른 문서의 anchor를 링크로 참조한다.
`../code-architecture.md#관리자-인증-허용-계정-판정`, `../flow.md#관리자-로그인과-세션`,
`../data-schema.md#관리자-인증-저장-계약`이 그것이며 고칠 때 깨뜨리지 않는다.

`.claude/rules/db-schema.md`는 `docs/data-schema.md#스키마-변경과-마이그레이션`을 가리킨다.
`docs/data-schema.md`의 `## 학습자료 저장 계약` 절만 지우고 그 anchor는 유지한다.

**근거 문서**: `docs/study-store-migration.md` 의 「문서 영향 판정」 절

## 의도 메모

- 공개 블로그 기능과 관리자 인증은 유지한다.
- 기존 ADR을 지우지 않고 대체 관계를 양쪽 문서에 기록한다.
- plan 번호는 오래 남는 docs와 ADR 본문에 적지 않는다.
- `docs/study-store-migration.md`는 이전 기간에만 필요한 문서다.
  내용을 옮기지 않은 채 지우면 결정 근거가 사라지므로 옮긴 뒤에 지운다.
- ADR 번호는 039가 다음 빈 번호다. 현재 `docs/adr/`의 마지막은 038이다.

## 선행 의존과 배포 조건

| 항목 | 조건 |
| --- | --- |
| 시작 조건 | Phase 05의 제거 image가 배포되고 정상 동작을 확인했다 |
| 배포 조건 | 문서 변경만 있으면 별도 배포 조건이 없다. 회귀 테스트에 코드 수정이 생기면 그때 배포한다 |

## Blocked 조건

- `src/app/api/study/v1`이 아직 있으면 `PHASE_BLOCKED: 제거 phase 미완료`를 출력하고 종료한다.
- 옛 inbound token이 배포 환경에 남아 있으면 `PHASE_BLOCKED: inbound token 미폐기`를 출력하고 종료한다.

## 작업 항목

### 1. 제품, 흐름과 API 책임 문서 수정

`docs/prd.md`에서 자료, 개인 상태, 추천과 게시 이력 저장 책임을 career-os Backend로 바꾼다.
`docs/flow.md`는 관리자 세션, Server Action, Backend client와 역할별 Bearer 호출 순서를 보여준다.
실패 흐름에 Backend timeout, 401과 403, 409, 429, 503을 포함하고 브라우저가 token을 보지 않는 조건을 적는다.

`docs/api/study-library.md`는 fos-blog가 제공하는 API 설명을 제거하고 Backend 소비 계약과 역할별 권한을 기록한다.
`## 인증 계약`의 `STUDY_SERVICE_TOKEN` 설명을 `producer`와 `admin-gateway` 두 역할로 바꾼다.
`## 소비측 호환 기준`의 fixture 경로를 Phase 05에서 옮긴 Backend 저장소 경로로 고친다.
DTO와 상태 코드의 단일 소스는 career-os Backend 문서로 옮기고 fos-blog 문서에는 UI가 의존하는 호환 조건만 둔다.

### 2. 코드와 데이터 구조 문서 수정

`docs/code-architecture.md`에서 study Route Handler, 서비스와 Repository 배치를 지우고
`src/lib/study/backend-client.ts`, study Server Action과 관리자 component의 의존 방향을 기록한다.

`docs/data-schema.md`의 `## 학습자료 저장 계약` 절을 지우고 소유권이 career-os Backend로 옮겨간 사실과 링크를 남긴다.
`## 스키마 변경과 마이그레이션`과 `## 관리자 인증 저장 계약` anchor는 유지한다.
기존 생성 migration과 새 제거 migration을 이력으로 보존한다는 조건을 함께 적는다.

### 3. ADR 추가와 대체 관계 기록

`docs/adr/039-career-study-backend-ownership.md`를 추가한다.
career-os Backend 소유권, dual-write를 쓰지 않는 단일 writer cutover,
사전 점검 판정으로 데이터 이관과 관찰을 조건부로 적용한 결정,
fos-blog가 기존 migration을 보존하고 forward migration으로 제거한 결정을 기록한다.

`docs/adr/037-private-study-domain.md`의 결정 바로 아래에 `**대체된 부분**`을 추가해
저장 위치 결정이 ADR-039로 바뀐 것을 적는다.
`docs/adr/038-study-atomic-ingestion.md`의 `status`를 `superseded`로 바꾸고
트랜잭션 계약이 새 Backend로 옮겨간 것과 ADR-039 링크를 적는다.
`docs/adr/README.md`의 「개인 학습자료」 절에 ADR-039 링크를 추가한다.

### 4. 공개 블로그와 관리자 화면 회귀 테스트

관리자 로그인, 자료 목록, 상태 충돌 복구, 추천 상세와 import 흐름을 Backend fixture로 검증한다.
익명 요청과 producer 권한으로 관리자 action을 쓸 수 없는지 검증한다.

공개 홈, 글 상세, 카테고리, sitemap, RSS, metadata와 광고 레이아웃 테스트를 실행한다.
`/api/study/v1`이 404이고 `/admin`과 `/api/auth`의 private header가 유지되는지 확인한다.
Docker image가 새 migration을 적용한 뒤 서버를 시작하고 공개 health check가 성공하는지 확인한다.

### 5. 이전 기준 문서 정리

`docs/study-store-migration.md`는 이전을 수행하는 동안만 필요한 조사와 실행 기준 문서다.
이전이 끝나면 그 내용이 아래 문서로 흡수되므로 파일을 지운다.

| 옮길 내용 | 받는 문서 |
| --- | --- |
| 데이터 소유권이 career-os Backend라는 결정과 근거 | `docs/adr/039-career-study-backend-ownership.md` |
| 단일 writer cutover와 사전 점검 조건부 적용 결정 | `docs/adr/039-career-study-backend-ownership.md` |
| 기존 migration 보존과 forward migration 제거 결정 | `docs/adr/039-career-study-backend-ownership.md` |
| fos-blog의 Backend client와 Server Action 배치 | `docs/code-architecture.md` |
| 관리자 세션부터 Backend 호출까지의 흐름과 실패 분기 | `docs/flow.md` |
| 역할별 권한과 소비 호환 조건 | `docs/api/study-library.md` |
| 저장 소유권이 외부로 옮겨간 사실 | `docs/data-schema.md` |

작업 항목 1부터 3까지가 끝나 위 내용이 모두 옮겨진 뒤에 지운다.
지우기 전에 다른 문서가 이 파일을 링크하는지 검색하고, 링크가 있으면 받는 문서로 바꾼다.
`tasks/plan065-career-study-store-migration/`의 phase 파일이 이 문서를 근거로 가리키지만
그 디렉터리도 plan이 끝나면 함께 제거되므로 따로 고치지 않는다.

### 6. 문서 검사와 계획 완료 테스트

바꾼 Markdown의 한국어 표현, 가독성, 링크와 anchor를 검사한다.
대상 테스트, lint, type-check, 전체 test와 build를 실행한다.

모든 검증이 통과하고 배포 뒤 옛 inbound token이 폐기됐으면
`tasks/plan065-career-study-store-migration/index.json`의 `status`를 `completed`,
`current_phase`를 `6`으로 바꾼다.

## 검증

fos-blog worktree에서 실행한다.

```bash
# cwd: 현재 구현 worktree의 저장소 root
/Users/nhn/personal/fos-skills/korean-check/scripts/check.sh docs/prd.md docs/flow.md docs/api/study-library.md docs/code-architecture.md docs/data-schema.md docs/adr/037-private-study-domain.md docs/adr/038-study-atomic-ingestion.md docs/adr/039-career-study-backend-ownership.md docs/adr/README.md
grep -q '스키마 변경과 마이그레이션' docs/data-schema.md
grep -q '관리자 인증 저장 계약' docs/data-schema.md
grep -q '관리자 인증: 허용 계정 판정' docs/code-architecture.md
grep -q '관리자 로그인과 세션' docs/flow.md
grep -q '039-career-study-backend-ownership' docs/adr/README.md
grep -q 'superseded' docs/adr/038-study-atomic-ingestion.md
test ! -e docs/study-store-migration.md
! grep -rn 'study-store-migration' docs/
! grep -rn 'plan065' docs/
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

문서 검사와 코드 검증이 모두 종료 코드 0이고 `index.json`이 `completed`여야 plan이 끝난다.

## 후속 Dispatch 단위

| Dispatch | 범위 |
| --- | --- |
| 책임 문서 수정 | 작업 항목 1과 2 |
| ADR 추가와 대체 관계 | 작업 항목 3 |
| 회귀 검증과 마감 | 작업 항목 4, 5, 6 |

문서 수정과 ADR 작성은 같은 Dispatch로 합쳐도 된다. 두 작업이 같은 결정을 다룬다.

## Rollback

문서 변경만 있으면 커밋을 되돌린다.
회귀 테스트에서 코드 결함이 나오면 문서를 고치기 전에 그 결함을 먼저 처리한다.

## 완료 조건

- 책임 문서가 로컬 study API와 MySQL 소유권을 현재 동작으로 설명하지 않는다.
- ADR-039가 추가되고 ADR-037과 ADR-038이 대체 관계를 담는다.
- 다른 문서의 anchor 링크가 깨지지 않았다.
- 공개 블로그와 관리자 화면 회귀 테스트가 통과했다.
- `docs/study-store-migration.md`의 내용이 책임 문서와 ADR로 옮겨졌고 파일이 삭제됐다.
- `index.json`의 `status`가 `completed`다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `docs/prd.md` | 데이터 소유권 수정 |
| `docs/flow.md` | Server Action과 Backend 호출 흐름 수정 |
| `docs/api/study-library.md` | 제공 API에서 소비 호환 계약으로 수정 |
| `docs/code-architecture.md` | Backend client와 action 배치 수정 |
| `docs/data-schema.md` | 학습자료 저장 계약 절 삭제와 소유권 링크 추가 |
| `docs/adr/037-private-study-domain.md` | 대체된 부분 추가 |
| `docs/adr/038-study-atomic-ingestion.md` | superseded 표시 |
| `docs/adr/039-career-study-backend-ownership.md` | 신규 |
| `docs/adr/README.md` | 새 ADR 링크 추가 |
| `docs/study-store-migration.md` | 내용을 위 문서로 옮긴 뒤 삭제 |
| `tasks/plan065-career-study-store-migration/index.json` | 완료 상태 반영 |
