import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { env } from "@/env";

// 캐시된 DB 인스턴스
let cachedDb: MySql2Database<typeof schema> | null = null;

/**
 * DB 연결 시도 — 연결 불가 시 null 반환
 * DB 없이도 동작해야 하는 곳(queries.ts 등)에서 사용
 */
export function tryGetDb(): MySql2Database<typeof schema> | null {
  // 이미 연결되어 있으면 캐시된 인스턴스 반환
  if (cachedDb) {
    return cachedDb;
  }

  // 런타임에 환경변수 확인
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[DB] DATABASE_URL is not set");
    return null;
  }

  // 개발 환경에서 쿼리 로깅 활성화
  const enableLogging = env.NODE_ENV === "development";

  const pool = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  cachedDb = drizzle(pool, {
    schema,
    mode: "default",
    logger: enableLogging,
  });

  console.log("Database connected successfully");
  return cachedDb;
}

/**
 * DB 연결 — 연결 불가 시 에러 throw
 * sync 등 DB가 반드시 필요한 서비스 레이어에서 사용
 */
export function getDb(): MySql2Database<typeof schema> {
  const db = tryGetDb();
  if (!db) {
    throw new Error(
      "Database not configured. Set DATABASE_URL environment variable."
    );
  }
  return db;
}

export { schema };
