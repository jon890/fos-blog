import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { createTestDatabase, getTestDatabaseUrl } from "./test-utils";
import { authSession, authUser } from "./schema/auth";

vi.mock("@/env", () => ({
  env: { get DATABASE_URL() { return getTestDatabaseUrl() ?? undefined; } },
}));

describe.skipIf(!getTestDatabaseUrl())("런타임 MySQL UTC 저장 계약", () => {
  const userId = "plan063-review-utc-user";
  let observer: Awaited<ReturnType<typeof createTestDatabase>> | undefined;
  let pool: Pool | undefined;

  beforeAll(async () => {
    vi.stubEnv("TZ", "Asia/Seoul");
    observer = await createTestDatabase();
    await observer.db.delete(authUser).where(eq(authUser.id, userId));
    const createPool = mysql.createPool.bind(mysql);
    vi.spyOn(mysql, "createPool").mockImplementation((options) => {
      pool = createPool(options);
      return pool;
    });
  });

  afterAll(async () => {
    try {
      if (observer) await observer.db.delete(authUser).where(eq(authUser.id, userId));
    } finally {
      await pool?.end();
      await observer?.connection.end();
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });

  it("프로세스가 한국 시간대여도 인증 DATETIME(3)은 실제 UTC 문자열로 저장한다", async () => {
    const { getDb } = await import("./index");
    const db = getDb();
    const createdAt = new Date("2026-08-01T00:01:02.345Z");
    const expiresAt = new Date("2026-08-08T00:01:02.345Z");
    expect(createdAt.getTimezoneOffset()).toBe(-540);
    await db.insert(authUser).values({
      id: userId, name: "UTC fixture", email: "plan063-review-utc@example.test",
      createdAt, updatedAt: createdAt,
    });
    await db.insert(authSession).values({
      id: "plan063-review-utc-session", userId, token: "plan063-review-utc-token",
      createdAt, updatedAt: createdAt, expiresAt,
    });
    if (!observer) throw new Error("격리 MySQL 관찰 연결이 필요합니다.");
    // CAST 결과는 문자열이다. mysql2의 Date 역변환으로 왕복 오차를 숨기지 않는다.
    const [rows] = await observer.connection.query<RowDataPacket[]>(
      "SELECT CAST(created_at AS CHAR) AS createdAt, CAST(updated_at AS CHAR) AS updatedAt, CAST(expires_at AS CHAR) AS expiresAt FROM auth_session WHERE user_id = ?",
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      createdAt: "2026-08-01 00:01:02.345",
      updatedAt: "2026-08-01 00:01:02.345",
      expiresAt: "2026-08-08 00:01:02.345",
    });
  });
});
