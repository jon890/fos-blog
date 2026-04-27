import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL not set");
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(databaseUrl);
  } catch (error) {
    console.error(
      "[migrate] DB connection failed:",
      error instanceof Error ? error.message : String(error)
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
