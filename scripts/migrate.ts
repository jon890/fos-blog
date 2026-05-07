import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const MAX_RETRIES = 10;
const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

function maskDatabaseUrl(message: string): string {
  return message.replace(/:([^@/]*)@/, ":***@");
}

async function connectWithRetry(
  databaseUrl: string
): Promise<mysql.Connection> {
  let lastError: Error = new Error(
    "DB 연결 최대 재시도 횟수 초과"
  );
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mysql.createConnection(databaseUrl);
      await conn.query("SELECT 1");
      if (attempt > 1) {
        console.log(`[migrate] DB ready after ${attempt} attempts`);
      }
      return conn;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = maskDatabaseUrl(lastError.message);
      const delay = Math.min(
        INITIAL_DELAY_MS * Math.pow(2, attempt - 1),
        MAX_DELAY_MS
      );
      console.log(
        `[migrate] DB not ready (attempt ${attempt}/${MAX_RETRIES}): ${msg} — retry in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL not set");
    process.exit(1);
  }

  let conn;
  try {
    conn = await connectWithRetry(databaseUrl);
  } catch (error) {
    const rawMsg =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[migrate] DB connection failed after retries:",
      maskDatabaseUrl(rawMsg)
    );
    process.exit(1);
  }

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

main().catch((err) => {
  console.error("[migrate] unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
