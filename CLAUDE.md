# fos-blog — Claude Code Project Context

**Updated:** 2026-04-24 | **Repo:** github.com/jon890/fos-blog | **Live:** https://blog.fosworld.co.kr

---

## What This Is

Next.js 16 developer blog that syncs Markdown from `jon890/fos-study` (GitHub) → MySQL → renders with GFM/mermaid. Features: categorization, dark/light mode, visit tracking, comments, full-text search.

**Deployment: Home server (Docker + standalone Next.js). NOT Vercel.**

---

## Tech Stack

| Layer       | Stack                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Framework   | Next.js 16.1.6 (App Router, Turbopack)                                 |
| Language    | TypeScript 5.7 (strict)                                                |
| Styling     | Tailwind CSS 4.1 + @tailwindcss/typography + shadcn/ui                 |
| Database    | MySQL 8.4 (Docker) + Drizzle ORM 0.45.1                                |
| GitHub API  | @octokit/rest 21.0.0                                                   |
| Markdown    | unified (remark-parse + remark-gfm + remark-rehype) + rehype-pretty-code (shiki, dual theme) + rehype-slug + rehype-raw + hast-util-to-jsx-runtime + mermaid |
| Logging     | pino (JSON) + pino-pretty (dev only)                                   |
| Testing     | Vitest 4.1.0                                                           |
| Package mgr | pnpm 9.15.0                                                            |

---

## Directory Structure

```
fos-blog/
├── src/
│   ├── app/              # Next.js App Router (pages + API routes)
│   ├── components/       # Reusable React UI components
│   ├── services/         # Business logic (SyncService, PostService, etc.)
│   ├── infra/
│   │   ├── db/           # Drizzle ORM — schema/, repositories/
│   │   └── github/       # Octokit client, API, file-filter, image-rewrite
│   ├── lib/              # Shared utils — markdown.ts, logger.ts, path-utils.ts
│   ├── middleware/       # Per-concern middleware — visit.ts (visit tracking), rateLimit.ts (1000/min/IP fixed window, RFC1918/봇 우회)
│   └── proxy.ts          # Next.js 16 proxy file convention (구 middleware.ts) — Node runtime 고정, `runtime` config 사용 불가
├── scripts/              # Build-time/start-up scripts — migrate.ts (drizzle migrator, 컨테이너 부팅 시 자동 apply)
├── local/                # Docker Compose + MySQL init.sql
├── drizzle/              # Migration artifacts (auto-generated, do not edit)
└── Dockerfile            # Multi-stage build (output: standalone)
```

---

## Key Scripts

```bash
pnpm dev           # Dev server (http://localhost:3000)
pnpm build         # Production build
pnpm lint          # ESLint
pnpm type-check    # tsc --noEmit
pnpm test          # Vitest

pnpm db:up         # Start MySQL container
pnpm db:down       # Stop MySQL container
pnpm db:push       # Apply schema changes
pnpm db:generate   # Generate migration files
pnpm db:migrate:runtime  # Run scripts/migrate.ts via tsx (로컬 검증; production 은 Dockerfile 에서 컴파일된 migrate.js 자동 실행)
pnpm db:studio     # Drizzle Studio GUI
pnpm setup         # db:up + db:push (first-time setup)
```

---

## Environment Variables

```env
# Required
GITHUB_TOKEN=ghp_...               # GitHub PAT
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
DATABASE_URL=mysql://fos_user:fos_password@localhost:13307/fos_blog
SYNC_API_KEY=...                   # Protects POST /api/sync

# Public / SEO
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
NEXT_PUBLIC_GOOGLE_ADSENSE_ID=ca-pub-...
```

See `.env.example` for full list.

---

## Conventions

- **Routing:** Next.js App Router (file-system based)
- **Components:** PascalCase, named exports, no direct DB calls
- **TypeScript:** strict mode, `@/*` path alias, `_` prefix for unused vars
- **Tailwind:** `src/app/globals.css` must include `@source` for every dir with Tailwind classes
- **Logging:** `logger.child({ module: '...' })` from `@/lib/logger` — no `console.log`. **예외**: `scripts/*.ts` 는 standalone 실행이라 path alias 미동작 → `console.log/error` 허용 (eslint.config.mjs 에서 globals 명시)
- **Error handling:** `err: error instanceof Error ? error : new Error(String(error))`
- **Tests:** co-located `*.test.ts`, Vitest, mock repositories with `vi.mock()`
- **API routes:** Bearer token auth via `SYNC_API_KEY`

---

## Architecture

```
app/ (routing)
  ↓
services/ (business logic)
  ↓
infra/db/ + infra/github/ (external systems)
  ↑
lib/ (shared utils — used everywhere)
```

- `app/` should not import directly from `infra/` — go through `services/`
- Schema source of truth: `src/infra/db/schema/` — 변경 후 `pnpm db:generate` 로 SQL 생성 → 커밋 → `pnpm db:migrate` 로 apply (아래 "DB 스키마 변경 규칙" 참조)
- `posts.path` = canonical GitHub file path (unique key, not `slug`)
- `posts.isActive` = soft delete — always filter `eq(posts.isActive, true)`

---

## DB 스키마 변경 규칙

- **`pnpm db:push` 프로덕션 사용 금지** — 마이그레이션 이력이 남지 않아 홈서버 배포 시 schema drift + 데이터 손실 위험
- 반드시 `pnpm db:generate`로 `drizzle/` 하위 SQL 파일 생성 → **git 커밋에 포함** → `pnpm db:migrate`로 apply
- 파괴적 변경(drop column/table, rename)은 SQL 파일 수동 검토 후 apply
- **로컬 실험** 한정으로 `pnpm db:push` 사용 가능. 단 커밋 전 반드시 `db:generate`로 마이그레이션화하거나 revert
- `drizzle/` 디렉터리는 git 추적 대상 (자동 생성물이지만 배포 환경에서 apply 필요)

---

## Home Server Deployment

**Not Vercel.** Do NOT suggest Vercel Cron, Edge Functions, or Vercel-specific ISR invalidation.

```bash
docker build -t fos-blog .
docker run -d --name fos-blog -p 3000:3000 --env-file .env fos-blog
```

Content sync cron (crontab):

```bash
0 * * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_API_KEY"
```

---

## Agent Operating Rules

webtoon-maker-v1에서 검증된 3 레포 공통 규칙. 하네스 (`.claude/skills/{planning,build-with-teams,docs-check}`)와 짝을 이룬다.

### 토큰 효율 (Opus/Sonnet 라우팅)

- **논의·계획·docs 작성**: main 세션 (opus 허용)
- **task phase 실행**: sonnet 기본 — rename, 리팩토링, 다중 파일 수정도 sonnet
- **task phase에서 opus 사용 금지 예외**:
  - 새 아키텍처 설계가 phase 안에 있는 경우
  - 복잡 알고리즘 설계 (도메인 핵심 신규 설계)
- **기계적 작업은 opus 금지** — rename/이동/경로 수정 등은 파일 수가 많아도 sonnet으로 충분
- 빌드 검증·커밋 phase는 haiku

### 파일 읽기 효율

- **전체 파일 읽기 금지** (200줄 초과 시) — offset+limit로 필요한 섹션만
- **같은 파일 반복 읽기 금지** — 같은 세션 내에서는 기억해서 재사용
- **대형 docs 파일**은 grep으로 필요 섹션만 찾아 offset 지정

### 조사/탐색 접근 방식

- **직접 질문에는 직접 답변부터** — 사용자가 특정 파일/영역/패턴을 명시했다면 해당 위치부터 확인. 광범위한 codebase 탐색 금지
- **사용자가 조사 경로를 제시했으면 그 경로부터** — 지시받은 영역에서 codebase 전체를 먼저 뒤지지 않는다
- **Explore agent는 최후 수단** — Grep/Glob/Read로 3번 이상 시도한 후에도 못 찾을 때만 사용
- **가정 없이 주장하지 않기** — "dead code", "미사용" 같은 판단은 실제로 참조를 grep한 후에만 제기

### 사용자 상호작용

- **선택지를 제시할 때는 `AskUserQuestion` 도구 사용** — "A안 / B안 / C안" 식 선택을 평문으로 나열하지 말 것. 옵션이 사전에 명확하면 yes/no 도 `AskUserQuestion` 으로. 자유 형식 답이 필요한 진짜 open-ended 질문(e.g. "어떤 docs 를 더 보강할까요?") 만 평문 사용

### Task 작업 규칙 (build-with-teams 사용 시)

- 각 phase는 **원자적 단일 책임** — 다른 관심사면 별도 phase로 분리. **작업 항목 5개 이하** 엄수
- **task 파일 생성 즉시 git commit** — `tasks/{plan}/index.json` + phase 파일을 실행 전에 커밋
- task 완료 즉시 git commit (index.json 상태 갱신 포함)
- 각 phase 프롬프트는 **자기완결적** (이전 대화 없이 독립 실행 가능)
- **docs 최신화는 task 생성 전 필수** — task phase 내에서 docs 변경 금지
- 산출된 critic 지적은 `.claude/skills/_shared/common-critic-patterns.md`에 append

### 문서 작성 원칙

- **AI 에이전트 컨텍스트 효율** — 이 문서들은 AI 에이전트를 위한 것. 컨텍스트를 낭비하지 않도록 간결하게
- **반복·중복 제거** — 같은 내용을 두 문서에 쓰지 않는다
- **의사결정 의도 보존** — "왜 이렇게 했는가" 반드시 기록
- **구현 세부사항은 코드에, docs에는 "무엇을·왜"만**

### Git & PR Conventions

PR 제목은 반드시 아래 형식을 따른다:

```
type(scope): description
```

예시: `feat(sync): add retry with exponential backoff`, `fix(db): prevent duplicate post insertion`, `docs(task): add layered architecture ADR`

---

## Summary for Agents

**Next.js 16 blog with layered architecture: app → services → infra.**

- **Key files:** `src/services/SyncService.ts`, `src/app/api/sync/route.ts`, `src/components/MarkdownRenderer.tsx`, `src/infra/db/schema/posts.ts`
- **Deployment:** Home server (Docker + standalone Next.js) + MySQL (Docker Compose)
- **Testing:** Vitest + co-located test files

**Agents should prioritize:**

1. Schema integrity (Drizzle types)
2. Sync idempotency (no duplicate/lost data)
3. Markdown fidelity (GFM, mermaid, links)
4. Type safety across API boundaries
