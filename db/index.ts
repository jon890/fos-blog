import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// 캐시된 DB 인스턴스
let cachedDb: MySql2Database<typeof schema> | null = null;

/**
 * 런타임에 DB 연결을 시도하는 getter
 * 빌드 시점이 아닌 런타임에 환경변수를 확인하여 DB 연결
 */
export function getDb(): MySql2Database<typeof schema> | null {
  // 이미 연결되어 있으면 캐시된 인스턴스 반환
  if (cachedDb) {
    return cachedDb;
  }

  // 런타임에 환경변수 확인
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL is not set");
    return null;
  }

  // 개발 환경에서 쿼리 로깅 활성화
  const enableLogging = process.env.NODE_ENV === "development";

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

export { schema };
