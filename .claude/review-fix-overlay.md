# review-fix 오버레이 — fos-blog

공용 코어(`~/.claude/skills/review-fix`)에 fos-blog 고유 진단 지식을 채운다.
검증 명령(lint/type-check/test/build)·PR 제목 형식·브랜치 네이밍은 레포 `CLAUDE.md` 를 그대로 따르며 여기서 반복하지 않는다.

## 머지 정책 — Merge commit (squash/rebase 아님)

fos-blog 는 PR 머지 시 **Merge commit** 을 사용한다 (`git log` 에 `Merge pull request #N` 커밋 존재).
따라서 base 동기화는 코어 2단계의 `git merge origin/<base>` 를 쓴다 — `git rebase` 로 대체하지 않는다.

## CI 실패 흔한 원인 → 해결 표

| 증상 (로그 키워드) | 원인 | 해결 |
| --- | --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` / `frozen-lockfile` 실패 | 로컬 의존성 변경 후 lockfile 미커밋 | `pnpm install` 후 `pnpm-lock.yaml` 같이 커밋 |
| `Cannot find module '@/...'` | `scripts/*` 는 path alias 미지원 | 상대 경로로 변경 |
| `tsc --noEmit` 실패 | strict mode 위반 / 타입 누락 / `as any` 회귀 | 해당 파일 타입 가드 추가 또는 시그니처 정합 |
| `eslint` 실패 | 미사용 import / `no-unused-vars` / `console.log` 위반 | `pnpm lint` 로 로컬 재현 후 픽스. `scripts/*` 의 console.log 는 eslint config globals 예외 |
| `vitest` 테스트 실패 | repository mock / Drizzle 타입 변경 영향 | 실패 테스트 파일 직접 읽고 픽스. mock 은 `vi.mock()` 패턴 일관 |
| `Drizzle migration` 실패 (`drizzle/0NNN_*.sql`) | 스키마 변경 후 `pnpm db:generate` 누락 / migration 파일 미커밋 | 로컬 `pnpm db:generate` → `drizzle/` 커밋 (`pnpm db:push` 프로덕션 금지) |
| `Next.js build` 실패 | env 변수 누락 (`SYNC_API_KEY` 등) / route 충돌 | `.env.example` 대비 env 변수 정합. CI secrets 등록 확인 |
| `Claude 코드 리뷰` workflow stuck (1시간+) | claude-code-action hang (issue #1290) | `timeout-minutes: 15` 설정 확인. hang 시 `gh run cancel` |
| `actions/X@vN: Unable to find action` | floating tag 가 cutoff 이후 제거 / 오타 | `curl -s https://api.github.com/repos/actions/X/tags` 로 실존 확인 |

표에 없는 증상은 사용자에게 로그 일부 + 의심 원인을 제시하고 진행 방향 확인.

## 실패 체크 → 로컬 명령 매칭

| CI 체크 이름 / 로그 키워드 | 로컬 명령 | 기대 소요 |
| --- | --- | --- |
| `Lint`, `eslint`, `no-unused-vars`, `no-console` | `pnpm lint` | ~10s |
| `Type check`, `tsc`, `Cannot find name`, `not assignable` | `pnpm type-check` | ~20s |
| `Test`, `vitest`, `FAIL src/` | `pnpm test --run` | ~10-60s |
| `Build`, `next build`, `Module not found` | `pnpm build` | ~60-120s |
| `Drizzle migration`, `drizzle/` | `pnpm db:migrate:runtime` (로컬 DB 필요 시 `pnpm db:up` 먼저) | ~5s |
| `ERR_PNPM_OUTDATED_LOCKFILE`, `frozen-lockfile` | `pnpm install --frozen-lockfile` | ~30-60s |

실행 순서: lint → type-check → test → build (가벼운 순서, build 는 항상 마지막). 여러 체크 실패 시 매칭 명령을 모두 실행해 한 사이클로 전체 실패 지점 파악.

## CI 워크플로 설정 점검 (`.github/workflows/*.yml`)

로컬 PASS + CI FAIL 일 때 (CI 환경 특수성) 점검한다.

| 점검 항목 | 확인 위치 | 흔한 수정 패턴 |
| --- | --- | --- |
| Node 버전 | `actions/setup-node` 의 `node-version` | 로컬 `node -v` 와 정합. floating major(`20`) 보다 명시(`20.18.0`) |
| pnpm 버전 | `pnpm/action-setup` 의 `version` 또는 `package.json` 의 `packageManager` | `package.json` 과 일치 (`pnpm@10.34.5`) |
| env vars | job 의 `env:` 블록 + `secrets.*` | 누락 secret 은 repo Settings → Secrets 등록. `.env.example` 대비 정합 |
| actions 버전 (floating tag) | `uses: actions/checkout@v4` 등 | `@v4` floating → `@v4.x.x` 고정 또는 SHA 고정 |
| 캐시 키 | `actions/cache` 의 `key:` | lockfile 해시 포함 정합 |

workflow 변경은 CI fix 와 같은 PR 에 커밋. `actions/` 버전 변경은 보안 영향 — 사용자 confirm.

## 커밋 이모지 규칙

review-fix 커밋은 conventional `type(scope):` 앞에 이모지를 붙인다: `🩹 fix(scope): ...`.

- `🩹` 버그/리뷰 수정 (review-fix 기본값)
- `♻️` 리팩토링
- `✨` 새 기능

## 학습 누적 위치 — `_shared/common-pitfalls.md`

재현 가능한 리뷰 패턴은 `.agents/skills/_shared/common-pitfalls.md` 에 누적한다 (`.claude/skills/_shared` 는 symlink).

| 패턴 종류 | 섹션 |
| --- | --- |
| 라이브러리 / DB / 타입 함정 (Next.js·Drizzle·MySQL·pino 등) | "### fos-blog (Next.js 16 / Drizzle ORM / MySQL / pino)" 의 `BLG#` |
| 일반 critic 시드 패턴 | 같은 파일 `P#` 시드 패턴 |
| 도메인 의사결정 / ADR 가치 | `docs/adr/NNN-slug.md` (신규 ADR, 자명성 게이트 통과 후) |
| 페이지/컴포넌트 흐름 변경 | `docs/pages/{page}.md` 해당 섹션 |

작성 형식:

```markdown
**BLG7. {짧은 패턴 이름}**
- {증상 1줄}
- **Good**: {해결책 1줄 + 코드 패턴}
- **Why**: {왜 발생하는지 / 검출 명령}
```

3-4줄 이상이면 시드 `P#` 형식(Bad/Good/Why/How to apply)으로 작성.

### 학습 commit — 코어 기본값(같은 PR 추가 commit) 대신 별도 main 직접 commit

fos-blog 는 학습 누적을 **PR 브랜치 commit 에 포함하지 않는다** (PR scope 외 — 코어 9단계 기본값을 오버라이드). PR 머지 후 main 직접 commit 이 원칙:

> **⚠️ 메인 디렉터리 사전 점검 (필수)** — main 디렉터리에 다른 브랜치 체크아웃·미푸시 commit·unstaged/untracked 변경이 있으면 학습 commit 이 그 작업과 섞일 위험.

```bash
[ "$(git status --short | wc -l | tr -d ' ')" = "0" ] && [ "$(git branch --show-current)" = "main" ] \
  || { echo "🚫 main 직접 commit 차단 — 다른 변경 또는 다른 브랜치 체크아웃 상태"; exit 1; }
git switch main && git pull --ff-only
# common-pitfalls.md 편집
git add .agents/skills/_shared/common-pitfalls.md
git commit -m "docs(skill): accumulate review learnings from PR #<N>"
git push origin main
```

`/review-fix` 자체는 학습 누적 commit 을 자동 수행하지 않고, 누적 내용을 보여준 뒤 "main 에 commit 할까요?" 확인한다.
