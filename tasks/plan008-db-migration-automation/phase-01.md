# Phase 01 — scripts/migrate.ts + Dockerfile entrypoint 통합 + 검증

## 컨텍스트 (자기완결 프롬프트)

배포마다 수동으로 `pnpm db:migrate` 실행하던 절차를 컨테이너 부팅 시 자동 적용으로 전환(ADR-018). drizzle-orm 의 migrator API 만으로 구현 — drizzle-kit CLI 미포함 가능.

## 먼저 읽을 문서

- `docs/adr.md` — **ADR-018** (마이그레이션 자동화)
- `Dockerfile` — 현재 multi-stage 구조 + production stage CMD
- `package.json` — drizzle-orm, mysql2 의존성 (이미 production deps)
- `drizzle.config.ts` — migrationsFolder 경로 확인 (`./drizzle`)
- `.claude/skills/_shared/common-critic-patterns.md` — BLG1 (db:push 금지), BLG2 (구조화 로그)

## 기존 코드 참조

- `Dockerfile:39-67` — production stage 구조 (`COPY --from=builder ...`, CMD)
- `package.json` — drizzle-orm 0.45.1, mysql2 (production)
- `drizzle/` 디렉터리 — `_journal.json` + `0001~0004_*.sql` 마이그레이션 파일

## 작업 목록 (총 4개)

### 1. `scripts/migrate.ts` 신규

```ts
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import logger from "@/lib/logger";

const log = logger.child({ module: "scripts/migrate" });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.error(
      { component: "migrate", operation: "init", err: new Error("DATABASE_URL missing") },
      "DATABASE_URL not set"
    );
    process.exit(1);
  }

  const conn = await mysql.createConnection(databaseUrl);
  const db = drizzle(conn);

  try {
    log.info({ component: "migrate", operation: "start" }, "applying migrations");
    await migrate(db, { migrationsFolder: "./drizzle" });
    log.info({ component: "migrate", operation: "complete" }, "migrations applied");
  } catch (error) {
    log.error(
      {
        component: "migrate",
        operation: "apply",
        err: error instanceof Error ? error : new Error(String(error)),
      },
      "migrations failed"
    );
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
```

- 절대경로 import (`@/lib/logger`) 사용 — tsconfig 의 paths 가 standalone 빌드에 반영되는지 검토 필요. 안 되면 `../src/lib/logger` 같은 상대경로 또는 `console.log` (start script 한정 예외 — BLG2 의 `console.error` 금지는 앱 코드 대상)
- 실패 시 `exit(1)` — 컨테이너 fail-fast (의도된 동작)

### 2. `package.json` `db:migrate` script 동기화

기존:
```json
"db:migrate": "drizzle-kit migrate"
```

변경 (또는 신규 추가):
```json
"db:migrate": "drizzle-kit migrate",
"db:migrate:runtime": "tsx scripts/migrate.ts"
```

- 로컬 개발 = `pnpm db:migrate` (drizzle-kit 으로 그대로)
- production 컨테이너 = `db:migrate:runtime` 또는 직접 `node migrate.js`

또는 단일 통합 — `db:migrate` 가 둘 다 호환되도록. 단순함 우선.

### 3. `Dockerfile` 수정

builder stage 에서 migrate.ts 빌드 (또는 tsx 사용 — production deps 에 포함하려면 별도 컴파일):

옵션 A: tsx 를 production deps 로 추가
```dockerfile
# production stage
RUN pnpm install --prod  # 기존
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/lib/logger.ts ./src/lib/logger.ts  # import 의존

CMD ["sh", "-c", "tsx scripts/migrate.ts && node server.js"]
```

옵션 B (권장): builder 에서 migrate.ts 를 .js 로 사전 컴파일
```dockerfile
# builder stage
RUN pnpm tsc --project tsconfig.scripts.json  # scripts/migrate.ts → dist/migrate.js

# production stage
COPY --from=builder /app/dist/migrate.js ./migrate.js
COPY --from=builder /app/drizzle ./drizzle

CMD ["sh", "-c", "node migrate.js && node server.js"]
```

신규 `tsconfig.scripts.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "noEmit": false,
    "module": "commonjs",
    "moduleResolution": "node"
  },
  "include": ["scripts/**/*.ts"]
}
```

→ **옵션 B 채택** (production 이미지에 tsx 미포함, 빌드 시 컴파일).

`Dockerfile` 수정 위치 (production stage):
```dockerfile
# Copy built files (기존)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 추가
COPY --from=builder --chown=nextjs:nodejs /app/dist/migrate.js ./migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# CMD 교체 (기존: ["node", "server.js"])
CMD ["sh", "-c", "node migrate.js && node server.js"]
```

builder stage 에 tsc 컴파일 step 추가:
```dockerfile
# Build stage 마지막
RUN pnpm tsc --project tsconfig.scripts.json
```

### 4. 로컬 검증 + 빌드 산출물 확인

```bash
# cwd: <worktree root>

# 1) 로컬에서 migrate.ts 단독 실행
pnpm tsx scripts/migrate.ts
# 기대: 이미 적용된 상태면 빠르게 완료. 새 마이그레이션 있으면 apply

# 2) 컴파일 산출물 확인
pnpm tsc --project tsconfig.scripts.json
test -f dist/migrate.js

# 3) Docker 빌드
docker build -t fos-blog:migrate-test .

# 4) 빌드 산출물에 migrate.js + drizzle 포함 확인
docker run --rm fos-blog:migrate-test ls -la /app/migrate.js /app/drizzle/_journal.json

# 5) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) scripts/migrate.ts 존재 + 핵심 import
test -f scripts/migrate.ts
grep -n 'from "drizzle-orm/mysql2/migrator"' scripts/migrate.ts
grep -n 'migrationsFolder' scripts/migrate.ts

# 2) tsconfig.scripts.json + tsc 컴파일 산출물
test -f tsconfig.scripts.json
pnpm tsc --project tsconfig.scripts.json
test -f dist/migrate.js

# 3) Dockerfile 변경
grep -n "COPY --from=builder.*migrate.js" Dockerfile
grep -n "COPY --from=builder.*drizzle" Dockerfile
grep -nE 'CMD\s+\[.*node migrate\.js.*node server\.js' Dockerfile

# 4) 빌드 stage 에 tsc compile 추가
grep -n "tsc --project tsconfig.scripts.json" Dockerfile

# 5) BLG2 구조화 로그 (logger 사용)
grep -n "logger.child" scripts/migrate.ts
grep -nE 'component:\s*"migrate"' scripts/migrate.ts
! grep -nE "console\.(log|error)" scripts/migrate.ts

# 6) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 7) Docker 빌드 + migrate.js 포함 확인
docker build -t fos-blog:plan008-test .
docker run --rm --entrypoint sh fos-blog:plan008-test -c "test -f /app/migrate.js && test -f /app/drizzle/_journal.json && echo OK"

# 8) 로컬 마이그레이션 idempotent 검증 (재실행해도 에러 없음)
pnpm tsx scripts/migrate.ts
pnpm tsx scripts/migrate.ts  # 두 번 연속 실행 모두 성공 (이미 적용된 것은 skip)
```

## PHASE_BLOCKED 조건

- `drizzle-orm/mysql2/migrator` 가 export 안 함 (버전 차이) → **PHASE_BLOCKED: drizzle-orm 0.45.1 의 migrator API 경로 재확인 (mysql vs mysql2 driver)**
- tsconfig.scripts.json 컴파일 시 `@/*` path alias 미해석 → **PHASE_BLOCKED: scripts 전용 tsconfig 의 paths 설정 필요 또는 import 경로를 상대경로로 변경**
- `node migrate.js` 실행 시 import.meta / ESM 문제 → **PHASE_BLOCKED: tsconfig module 설정 (commonjs vs esnext) 재검토**
- Docker 빌드 시 `pnpm tsc` 가 builder stage 의 tsconfig 를 못 찾음 → **PHASE_BLOCKED: COPY 순서 재정리**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(scripts): add migrate.ts using drizzle-orm migrator`
- `chore(build): compile scripts via tsconfig.scripts.json + Dockerfile entrypoint`
- `chore(deploy): include drizzle/ + migrate.js in production image`

## 운영 영향

- **첫 배포** 후 컨테이너 부팅 시 `0004_cleanup_stale_visits.sql` 자동 적용 (홈서버 cleanup 완료) — 단 사용자가 이미 수동으로 cleanup 실행했으면 DELETE 0 row 처리 (무해)
- 매 배포: 새 마이그레이션 있으면 자동 apply, 없으면 수백 ms 부팅 비용
- 마이그레이션 실패 시 컨테이너 fail-fast → 사용자 SSH 후 수동 검토 (의도된 안전장치)
