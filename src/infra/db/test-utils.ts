import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import * as schema from "./schema";

type TestDatabaseEnv = {
  RUN_DB_TESTS?: string;
  TEST_DATABASE_URL?: string;
};

export function getTestDatabaseUrl(
  env: TestDatabaseEnv = {
    RUN_DB_TESTS: process.env.RUN_DB_TESTS,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
): string | null {
  if (env.RUN_DB_TESTS !== "1") return null;
  if (!env.TEST_DATABASE_URL) {
    throw new Error("RUN_DB_TESTS=1에는 격리된 TEST_DATABASE_URL이 필요합니다.");
  }
  let url: URL;
  try {
    url = new URL(env.TEST_DATABASE_URL);
  } catch {
    throw new Error("TEST_DATABASE_URL은 유효한 MySQL URL이어야 합니다.");
  }
  if (
    url.protocol !== "mysql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/fos_blog_test_[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search || url.hash
  ) {
    throw new Error("TEST_DATABASE_URL은 loopback 호스트와 fos_blog_test_ 접두사 DB만 허용하며 query와 fragment는 금지합니다.");
  }
  return env.TEST_DATABASE_URL;
}

export async function createTestDatabase() {
  const databaseUrl = getTestDatabaseUrl();
  if (!databaseUrl) throw new Error("실DB 검증은 RUN_DB_TESTS=1로 실행해야 합니다.");
  const url = new URL(databaseUrl);
  const connection = await mysql.createConnection({
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    timezone: "Z",
  });
  const db = drizzle(connection, { schema, mode: "default", logger: false });
  return { connection, db };
}

export async function migrateTestDatabase(
  fixture: Awaited<ReturnType<typeof createTestDatabase>>,
): Promise<void> {
  await fixture.connection.query("SELECT GET_LOCK('fos_blog_test_migrations', 30)");
  try {
    await migrate(fixture.db, { migrationsFolder: path.resolve("drizzle") });
  } finally {
    await fixture.connection.query("SELECT RELEASE_LOCK('fos_blog_test_migrations')");
  }
}
