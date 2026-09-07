import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { RowDataPacket } from "mysql2";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, getTestDatabaseUrl } from "../test-utils";
import { authAccount, authSession, authUser, authVerification } from "./auth";
import { posts } from "./posts";

describe("격리 DB 설정", () => {
  it("기본 단위 테스트는 DB 연결을 사용하지 않는다", () => {
    expect(getTestDatabaseUrl({})).toBeNull();
  });

  it("명시적 DB 검증에는 TEST_DATABASE_URL이 필요하다", () => {
    expect(() => getTestDatabaseUrl({ RUN_DB_TESTS: "1" })).toThrow("TEST_DATABASE_URL");
  });

  it.each([
    "not-a-url",
    "postgres://localhost/fos_blog_test_auth",
    "mysql://db.example.com/fos_blog_test_auth",
    "mysql://127.0.0.1/fos_blog",
    "mysql://127.0.0.1/fos_blog_test_",
    "mysql://127.0.0.1/fos_blog_test_auth?host=db.example.com",
    "mysql://127.0.0.1/fos_blog_test_auth?socketPath=/tmp/mysql.sock",
    "mysql://127.0.0.1/fos_blog_test_auth#fragment",
  ])("격리 조건을 벗어난 URL 거절: %s", (url) => {
    expect(() => getTestDatabaseUrl({ RUN_DB_TESTS: "1", TEST_DATABASE_URL: url })).toThrow("TEST_DATABASE_URL");
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("loopback 호스트 허용: %s", (host) => {
    const url = `mysql://fixture:password@${host}:3306/fos_blog_test_auth`;
    expect(getTestDatabaseUrl({ RUN_DB_TESTS: "1", TEST_DATABASE_URL: url })).toBe(url);
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("인증 MySQL 스키마", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  const now = new Date("2026-01-02T03:04:05.678Z");
  const timestamps = { createdAt: now, updatedAt: now };
  const userIds = ["schema-user", "schema-User", "schema-other"];
  const postPath = "test-fixtures/auth-schema-preserved.md";
  const user = (id = userIds[0]) => ({
    id, name: "Schema fixture", email: `${id.replace("User", "capital")}@example.test`, ...timestamps,
  });
  const session = (id = "schema-session", token = "Schema-token") => ({
    id, token, userId: userIds[0], expiresAt: new Date("2026-01-09T03:04:05.678Z"), ...timestamps,
  });
  const account = (id = "schema-account") => ({
    id, userId: userIds[0], providerId: "github", accountId: "123456789", ...timestamps,
  });

  beforeAll(async () => {
    fixture = await createTestDatabase();
    const migrationsFolder = path.resolve("drizzle");
    const journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const previous = { ...journal, entries: journal.entries.filter((e) => e.idx <= 10) };
    const temporaryFolder = await mkdtemp(path.join(tmpdir(), "fos-blog-auth-migrations-"));
    try {
      await mkdir(path.join(temporaryFolder, "meta"));
      await writeFile(path.join(temporaryFolder, "meta/_journal.json"), JSON.stringify(previous));
      await Promise.all(previous.entries.map((entry) =>
        copyFile(path.join(migrationsFolder, `${entry.tag}.sql`), path.join(temporaryFolder, `${entry.tag}.sql`)),
      ));
      await migrate(fixture.db, { migrationsFolder: temporaryFolder });
    } finally {
      await rm(temporaryFolder, { recursive: true, force: true });
    }

    await fixture.db.insert(posts).values({
      path: postPath, title: "보존할 공개 글", slug: "auth-schema-preserved", category: "fixture",
      content: "인증 마이그레이션 전후 동일한 내용",
    });
    const existingTables = ["categories", "comments", "folders", "glossary_mentions", "glossary_terms", "posts", "sync_logs", "visit_logs", "visit_stats"];
    const snapshot = async () => Promise.all(existingTables.map(async (table) => {
      const [definition] = await fixture!.connection.query("SHOW CREATE TABLE ??", [table]);
      const [rows] = await fixture!.connection.query("SELECT * FROM ?? ORDER BY id", [table]);
      return { table, definition, rows };
    }));
    const before = await snapshot();
    await migrate(fixture.db, { migrationsFolder });
    expect(await snapshot()).toEqual(before);
    const [applied] = await fixture.connection.query("SELECT * FROM __drizzle_migrations ORDER BY id");
    await migrate(fixture.db, { migrationsFolder });
    const [repeated] = await fixture.connection.query("SELECT * FROM __drizzle_migrations ORDER BY id");
    expect(repeated).toEqual(applied);
    expect(await snapshot()).toEqual(before);
  }, 30_000);

  afterEach(async () => {
    if (!fixture) return;
    await fixture.db.delete(authUser).where(inArray(authUser.id, userIds));
    await fixture.db.delete(authVerification).where(eq(authVerification.id, "schema-verification"));
  });

  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(posts).where(eq(posts.path, postPath));
    } finally {
      await fixture.connection.end();
    }
  });

  it("추가 테이블 네 개와 UTC 밀리초·문자열 저장 계약을 적용한다", async () => {
    const { db, connection } = fixture!;
    const [tables] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'auth_%' ORDER BY TABLE_NAME",
    );
    expect(tables.map((table) => table.name)).toEqual(["auth_account", "auth_session", "auth_user", "auth_verification"]);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DATETIME_PRECISION, COLLATION_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'auth_%'",
    );
    for (const column of columns) {
      if (column.COLUMN_NAME.endsWith("_at")) {
        expect(column.DATA_TYPE).toBe("datetime");
        expect(column.DATETIME_PRECISION).toBe(3);
      }
      if (["id", "user_id", "account_id", "provider_id", "token", "identifier"].includes(column.COLUMN_NAME)) {
        expect(column.COLLATION_NAME).toBe("utf8mb4_bin");
        expect(column.CHARACTER_MAXIMUM_LENGTH).toBe(255);
      }
    }
    await db.insert(authUser).values(user());
    await db.insert(authSession).values(session());
    await db.insert(authAccount).values(account());
    await db.insert(authVerification).values({
      id: "schema-verification", identifier: "oauth-state", value: "fixture-value", expiresAt: now, ...timestamps,
    });
    expect(await db.select().from(authUser).where(eq(authUser.id, userIds[0]))).toEqual([
      { ...user(), emailVerified: false, image: null },
    ]);
    const [storedSession] = await db.select().from(authSession).where(eq(authSession.id, "schema-session"));
    expect(storedSession).toEqual({ ...session(), ipAddress: null, userAgent: null });
  });

  it("동일한 provider/account와 session token을 거절한다", async () => {
    const { db } = fixture!;
    await db.insert(authUser).values([user(), user(userIds[2])]);
    await db.insert(authAccount).values(account());
    await expect(db.insert(authAccount).values({ ...account("duplicate-account"), userId: userIds[2] })).rejects.toMatchObject({ cause: { code: "ER_DUP_ENTRY" } });
    await db.insert(authSession).values(session());
    await expect(db.insert(authSession).values(session("duplicate-session"))).rejects.toMatchObject({ cause: { code: "ER_DUP_ENTRY" } });
    await expect(db.insert(authUser).values({ ...user(userIds[1]), email: user().email })).rejects.toMatchObject({ cause: { code: "ER_DUP_ENTRY" } });
  });

  it("대소문자가 다른 ID·token·provider/account는 구분한다", async () => {
    const { db } = fixture!;
    await db.insert(authUser).values([user(), user(userIds[1])]);
    await db.insert(authSession).values([session(), session("schema-Session", "schema-token")]);
    await db.insert(authAccount).values([
      account(), { ...account("schema-account-capital"), providerId: "GitHub" },
      { ...account("schema-account-uppercase"), accountId: "Account" },
      { ...account("schema-account-lowercase"), accountId: "account" },
    ]);
    expect(await db.select().from(authUser).where(inArray(authUser.id, userIds))).toHaveLength(2);
    expect(await db.select().from(authSession).where(eq(authSession.userId, userIds[0]))).toHaveLength(2);
    expect(await db.select().from(authAccount).where(eq(authAccount.userId, userIds[0]))).toHaveLength(4);
  });

  it("user 삭제는 session/account만 cascade하고 공개 글과 verification을 보존한다", async () => {
    const { db } = fixture!;
    await db.insert(authUser).values(user());
    await db.insert(authSession).values(session());
    await db.insert(authAccount).values(account());
    await db.insert(authVerification).values({
      id: "schema-verification", identifier: "oauth-state", value: "fixture-value", expiresAt: now, ...timestamps,
    });
    await db.delete(authUser).where(eq(authUser.id, userIds[0]));
    expect(await db.select().from(authSession).where(eq(authSession.userId, userIds[0]))).toEqual([]);
    expect(await db.select().from(authAccount).where(eq(authAccount.userId, userIds[0]))).toEqual([]);
    expect(await db.select().from(authVerification).where(eq(authVerification.id, "schema-verification"))).toHaveLength(1);
    expect(await db.select().from(posts).where(eq(posts.path, postPath))).toHaveLength(1);
  });

  it("없는 사용자 참조와 VARCHAR(255) 초과를 거절한다", async () => {
    const { db } = fixture!;
    await expect(db.insert(authSession).values(session())).rejects.toMatchObject({ cause: { code: "ER_NO_REFERENCED_ROW_2" } });
    await expect(db.insert(authAccount).values(account())).rejects.toMatchObject({ cause: { code: "ER_NO_REFERENCED_ROW_2" } });
    await db.insert(authUser).values(user());
    await db.insert(authSession).values(session("schema-session", "a".repeat(255)));
    await expect(db.insert(authSession).values(session("too-long-session", "a".repeat(256)))).rejects.toMatchObject({ cause: { code: "ER_DATA_TOO_LONG" } });
  });
});
