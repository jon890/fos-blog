import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// 환경변수에서 DB URL 가져오기
const connectionString = process.env.DATABASE_URL;

// 개발 환경에서 쿼리 로깅 활성화
const enableLogging = process.env.NODE_ENV === "development";

let db: MySql2Database<typeof schema> | null = null;

// DB가 설정된 경우에만 연결
if (connectionString) {
  const pool = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  db = drizzle(pool, {
    schema,
    mode: "default",
    logger: enableLogging,
  });
}

export { db, schema };
