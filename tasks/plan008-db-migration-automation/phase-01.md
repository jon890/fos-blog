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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL not set");
    process.exit(1);
  }

  const conn = await mysql.createConnection(databaseUrl);
  const db = drizzle(conn);

  try {
    console.log("[migrate] applying migrations");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] migrations applied");
  } catch (error) {
    console.error(
      "[migrate] migrations failed:",
      error instanceof Error ? error.message : String(error)
    );
    await conn.end();
    process.exit(1);
  }

  await conn.end();
}

main();
```

설계 결정:
- **`console.log/error` 사용** (BLG2 예외) — start script(컨테이너 부팅) 한정. 앱 코드 아님 + pino 의존 시 paths alias/모듈 resolve 문제로 옵션 B 빌드 실패 위험. 부팅 로그는 docker logs 로 충분 가시성
- **`process.exit(1)` 전 `await conn.end()` 명시** (finally 미실행 회피) — exit() 는 finally 블록 건너뜀
- **fail-fast**: 실패 시 컨테이너 부팅 실패 → 다음 기동 전 수동 개입 (의도된 안전장치)

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

### 4. `.gitignore` 에 `dist/` 추가 + 검증

`dist/migrate.js` 는 빌드 산출물 (Dockerfile builder stage 에서 생성, production stage 로 COPY). git 추적 대상 아님.

```bash
# cwd: <worktree root>

# 1) .gitignore 확인 / 추가
grep -E '^dist/?$' .gitignore || echo "dist/" >> .gitignore

# 2) 로컬 컴파일 검증
pnpm tsc --project tsconfig.scripts.json
test -f dist/migrate.js

# 3) production 실행 경로 검증 (import resolve 만 — DB 미설정 시 fail-fast 정상)
node dist/migrate.js 2>&1 | grep -q "DATABASE_URL not set" && echo "import resolve OK"

# 4) Docker 빌드 + 산출물 확인
docker build -t fos-blog:migrate-test .
docker run --rm --entrypoint sh fos-blog:migrate-test -c "test -f /app/migrate.js && test -f /app/drizzle/_journal.json && echo OK"

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

# 5) start script BLG2 예외 (console 사용 정당) — logger import 없음
! grep -n 'from "@/lib/logger"' scripts/migrate.ts
! grep -n "logger.child" scripts/migrate.ts
grep -nE "console\.(log|error)" scripts/migrate.ts

# 6) .gitignore 에 dist/ 추가
grep -nE '^dist/?$' .gitignore

# 7) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 8) Docker 빌드 + migrate.js 포함 + import resolve 검증
docker build -t fos-blog:plan008-test .
docker run --rm --entrypoint sh fos-blog:plan008-test -c "test -f /app/migrate.js && test -f /app/drizzle/_journal.json && echo OK"

# 9) production 실행 경로 검증 — node dist/migrate.js (DATABASE_URL 미설정으로 fail-fast 도달 = import resolve 성공 증거)
node dist/migrate.js 2>&1 | grep -q "DATABASE_URL not set" && echo "import resolve OK"

# 10) 로컬 마이그레이션 idempotent (DB 가동 시)
pnpm tsx scripts/migrate.ts
pnpm tsx scripts/migrate.ts  # 두 번 연속 실행 모두 성공 (이미 적용된 것은 skip)
```

## PHASE_BLOCKED 조건

- `drizzle-orm/mysql2/migrator` export 부재 (버전 차이) → **PHASE_BLOCKED: drizzle-orm 0.45.1 의 migrator API 경로 재확인** — 첫 작업에서 `test -f node_modules/drizzle-orm/mysql2/migrator.js` 또는 `package.json` `exports` 필드로 사전 검증
- `node dist/migrate.js` 실행 시 ESM/commonjs 충돌 → **PHASE_BLOCKED: tsconfig.scripts.json module 설정 재검토 (commonjs 채택)**
- Docker 빌드 시 builder stage 의 `tsconfig.scripts.json` 미발견 → **PHASE_BLOCKED: COPY 순서 재정리 (tsconfig 들 builder 초반 COPY)**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `feat(scripts): add migrate.ts using drizzle-orm migrator`
- `chore(build): compile scripts via tsconfig.scripts.json + Dockerfile entrypoint`
- `chore(deploy): include drizzle/ + migrate.js in production image`

## 운영 영향

- **첫 배포** 후 컨테이너 부팅 시 `0004_cleanup_stale_visits.sql` 자동 적용 (홈서버 cleanup 완료) — 단 사용자가 이미 수동으로 cleanup 실행했으면 DELETE 0 row 처리 (무해)
- 매 배포: 새 마이그레이션 있으면 자동 apply, 없으면 수백 ms 부팅 비용
- 마이그레이션 실패 시 컨테이너 fail-fast → 사용자 SSH 후 수동 검토 (의도된 안전장치)
