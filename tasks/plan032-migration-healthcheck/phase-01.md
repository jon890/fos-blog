# Phase 01 — migrate.ts retry loop

**Model**: sonnet
**Goal**: 컨테이너 기동 시 DB 가 아직 ready 가 아닐 때 즉시 실패하지 않도록 connection retry loop 추가.

## Context (자기완결)

`scripts/migrate.ts` 가 컨테이너 기동 시 첫 라인에서 `mysql.createConnection(databaseUrl)` 호출. MySQL 컨테이너가 아직 ready 가 아니면 `ECONNREFUSED` 또는 `ENOTFOUND` 로 즉시 process.exit(1).

**현재 상태**: 홈서버 docker-compose 가 MySQL 먼저 기동 + `restart=unless-stopped` 정책으로 일시 실패 자연 복구. 그러나 일시 장애 시 컨테이너 재시작 사이클 길어짐.

**Production docker-compose.yml 은 repo 외부** (홈서버 인프라 privacy 메모) — Option A (compose healthcheck condition) 는 repo 에서 작업 불가. **Option B (application-level retry loop) 만 채택**.

**플젝 컨벤션**:
- `scripts/*.ts` 는 standalone — `console.log/error` 허용 (eslint config 명시)
- Dockerfile 의 CMD: `node migrate.js && node server.js` 그대로 유지

## 작업 항목

### 1. `scripts/migrate.ts` connection retry 추가

```ts
const MAX_RETRIES = 10;
const INITIAL_DELAY_MS = 500;

async function connectWithRetry(databaseUrl: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mysql.createConnection(databaseUrl);
      // 실제 ping 으로 ready 확인
      await conn.query("SELECT 1");
      if (attempt > 1) {
        console.log(`[migrate] DB ready after ${attempt} attempts`);
      }
      return conn;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
      // 지수 백오프 — 0.5s → 1s → 2s → 4s → 8s → ... cap 5s
      const cappedDelay = Math.min(delay, 5_000);
      console.log(
        `[migrate] DB not ready (attempt ${attempt}/${MAX_RETRIES}): ${msg} — retry in ${cappedDelay}ms`
      );
      await new Promise((r) => setTimeout(r, cappedDelay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}
```

총 대기 시간: 0.5 + 1 + 2 + 4 + 5 + 5 + 5 + 5 + 5 + 5 = ~37 초. 이 안에 DB 가 ready 안 되면 종료.

### 2. main() 함수 connection 부분 교체

기존:
```ts
let conn;
try {
  conn = await mysql.createConnection(databaseUrl);
} catch (error) {
  console.error("[migrate] DB connection failed:", ...);
  process.exit(1);
}
```

→

```ts
let conn;
try {
  conn = await connectWithRetry(databaseUrl);
} catch (error) {
  console.error(
    "[migrate] DB connection failed after retries:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
```

migrate(db, ...) 호출 부분과 catch 블럭은 그대로 유지.

### 3. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build  # tsc 컴파일이 migrate.ts 도 포함되는지 확인 — 안 되면 `pnpm build:migrate` 또는 Dockerfile 의 별도 컴파일 스텝

# scripts/migrate.ts 가 retry loop 포함
grep -n "connectWithRetry\|MAX_RETRIES" scripts/migrate.ts
```

수동 smoke (사용자 안내):
```bash
# DB 끄고 migrate 실행 → retry 로그 확인 → DB 켜면 성공
pnpm db:down
pnpm db:migrate:runtime &
# 5초 대기 후 DB 기동
sleep 5
pnpm db:up
# migrate 가 retry 로 connection 성공 + 마이그레이션 적용 확인
wait
```

### 4. `tasks/plan032-migration-healthcheck/index.json` status="completed" 마킹

phase 완료 시.

## Critical Files

| 파일 | 상태 |
|---|---|
| `scripts/migrate.ts` | 수정 (connectWithRetry 추가) |

## Out of Scope

- production docker-compose.yml healthcheck condition (repo 외부)
- migrate 외 다른 startup 스크립트 (없음)
- mysqladmin ping shell wrapper (Node 단 retry 가 더 portable)

## Risks

| 리스크 | 완화 |
|---|---|
| 영구 장애 시 ~37초 대기 후 컨테이너 종료 | restart=unless-stopped 정책으로 자동 재시작 → 다음 사이클에서 다시 시도. 영향 미미 |
| MAX_RETRIES + delay 가 K8s liveness probe timeout 보다 김 | 홈서버 단일 호스트라 K8s 미사용. 향후 확장 시 reconfig |
| ping 으로 SELECT 1 추가 호출이 정상 케이스에서 50ms 지연 | 무시 가능 |
