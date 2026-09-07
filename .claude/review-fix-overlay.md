# fos-blog review-fix 오버레이

공용 코어(`~/.claude/skills/review-fix`)에 fos-blog 고유 진단 지식을 채운다.
검증 명령(lint/type-check/test/build)과 PR 규칙은 레포 `CLAUDE.md` 를 그대로 따르며 여기서 반복하지 않는다.

## 머지 정책

fos-blog 는 PR 머지 시 **Merge commit** 을 사용한다 (`git log` 에 `Merge pull request #N` 커밋 존재).
따라서 base 동기화는 코어의 `git merge origin/<base>`를 사용한다.

## CI 실패 흔한 원인 → 해결 표

| 증상 (로그 키워드) | 원인 | 해결 |
| --- | --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` / `frozen-lockfile` 실패 | 로컬 의존성 변경 후 lockfile 미커밋 | `pnpm install` 후 `pnpm-lock.yaml` 같이 커밋 |
| `Cannot find module '@/...'` | `scripts/*` 는 path alias 미지원 | 상대 경로로 변경 |
| `tsc --noEmit` 실패 | strict mode 위반 / 타입 누락 / `as any` 회귀 | 해당 파일 타입 가드 추가 또는 시그니처 정합 |
| `eslint` 실패 | 파싱 오류 또는 `error` 등급 규칙 위반 | `pnpm lint`로 재현한다. 규칙과 적용 파일은 `eslint.config.mjs`, 로깅 계약은 [로깅과 오류](../docs/code-architecture.md#로깅과-오류)를 확인한다 |
| `vitest` 테스트 실패 | repository mock / Drizzle 타입 변경 영향 | 실패 테스트 파일 직접 읽고 픽스. mock 은 `vi.mock()` 패턴 일관 |
| `Drizzle migration` 실패 (`drizzle/0NNN_*.sql`) | 생성 또는 커밋 누락 | [마이그레이션 절차](../docs/data-schema.md#스키마-변경과-마이그레이션)에 따라 생성 산출물과 적용 결과를 확인한다 |
| `Next.js build` 실패 | env 변수 누락 (`SYNC_API_KEY` 등) / route 충돌 | `.env.example` 대비 env 변수 정합. CI secrets 등록 확인 |
| `Claude 코드 리뷰` workflow stuck (1시간+) | claude-code-action hang (issue #1290) | `gh run cancel` 후 재실행. `claude-code-review.yml` 의 `timeout-minutes` 가 워크플로를 끊어 준다 |
| `actions/X@vN: Unable to find action` | floating tag 가 cutoff 이후 제거 / 오타 | `curl -s https://api.github.com/repos/actions/X/tags` 로 실존 확인 |

표에 없는 증상은 사용자에게 로그 일부와 의심 원인을 제시하고 진행 방향을 확인한다.

## 실패 체크 → 로컬 명령 매칭

CI 의 `ci.yml` 은 `Lint, Test & Build` 단일 job 이므로 체크 이름이 아니라 실패한 step 이름과 로그 키워드로 구분한다.

| step 이름 / 로그 키워드 | 로컬 명령 | 기대 소요 |
| --- | --- | --- |
| `Run lint`, `eslint`, `1 error` | `pnpm lint` | ~10s |
| `Type check`, `tsc`, `Cannot find name`, `not assignable` | `pnpm type-check` | ~20s |
| `Test`, `vitest`, `FAIL src/` | `pnpm test` | ~10-60s |
| `Build`, `next build`, `Module not found` | `pnpm build` | ~60-120s |
| `Drizzle migration`, `drizzle/` | `docker compose -f local/docker-compose.yml up -d` 후 `pnpm db:migrate:runtime` | ~5s |
| `ERR_PNPM_OUTDATED_LOCKFILE`, `frozen-lockfile` | `pnpm install --frozen-lockfile` | ~30-60s |

여러 검사가 실패하면 대응 명령을 한 주기에 모두 실행해 전체 실패 지점을 파악한다.

## CI 워크플로 설정 점검 (`.github/workflows/*.yml`)

로컬에서는 통과하고 CI에서 실패할 때 환경 차이를 점검한다.

| 점검 항목 | 확인 위치 | 흔한 수정 패턴 |
| --- | --- | --- |
| Node 버전 | `actions/setup-node` 의 `node-version` | 로컬 `node -v`와 정합<br>가능하면 정확한 버전 명시 |
| pnpm 버전 | `pnpm/action-setup` 의 `version` 또는 `package.json` 의 `packageManager` | `package.json`의 `packageManager`와 일치 |
| 환경 변수 | job의 `env:` 블록<br>`secrets.*` | 누락 secret은 저장소 설정에 등록<br>`.env.example`과 대조 |
| actions 버전 (floating tag) | `uses: actions/checkout@v4` 등 | `@v4` floating → `@v4.x.x` 고정 또는 SHA 고정 |
| 캐시 키 | `actions/cache` 의 `key:` | lockfile 해시 포함 정합 |

workflow 변경은 CI 수정과 같은 PR에 커밋한다.
`actions/` 버전 변경은 보안 영향을 확인하고 사용자 승인을 받는다.

## 커밋 형식

커밋 제목 형식은 기존 히스토리를 따른다.
제목 앞에 이모지를 붙이지 않는다.
히스토리에 `📝 docs(review): ...` 같은 접두사가 섞여 있으므로 기존 제목을 그대로 복사하지 않는다.

## 회고와 계약 문서

기존 사례는 [회고 목록](../docs/retrospectives/INDEX.md)에서 찾아 해당 문서를 갱신한다.
새 사례는 설치된 스킬의 회고 절차와 기존 개별 문서 형식을 따른다.
현재 제품 계약은 기존 책임 문서에 반영하고 회고에서는 그 절을 링크한다.
장기 결정의 이유와 기각한 대안은 ADR, 실행 결과는 [실행 기록](../docs/retrospectives/RUNS.md)에 남긴다.

### 학습 반영

학습 누적은 리뷰 수정 PR에 섞지 않는다.
초안을 사용자에게 보여준 뒤 승인된 내용만 별도 `docs/` 또는 `chore/` 브랜치와 PR로 반영한다.
`main`에 직접 commit 또는 push하지 않는다.
