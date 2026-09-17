import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "./test-utils";

/** 새 forward migration 이 지워야 하는 13개 테이블이다. */
const STUDY_TABLES = [
  "study_material_sources",
  "study_material_states",
  "study_material_tags",
  "study_materials",
  "study_publications",
  "study_recommendation_control",
  "study_recommendation_items",
  "study_recommendation_runs",
  "study_recommendation_topics",
  "study_recommended_materials",
  "study_request_receipts",
  "study_source_cursors",
  "study_sources",
];
const KEPT_TABLES = ["auth_account", "auth_session", "auth_user", "categories", "glossary_terms", "posts"];
const MIGRATIONS_FOLDER = path.resolve("drizzle");

type Fixture = Awaited<ReturnType<typeof createTestDatabase>>;
type Journal = { entries: { idx: number; tag: string }[] };

async function tableNames(fixture: Fixture): Promise<string[]> {
  const [rows] = await fixture.connection.query<mysql.RowDataPacket[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  return rows.map((row) => String(row.name)).sort();
}

async function resetDatabase(fixture: Fixture): Promise<void> {
  const names = await tableNames(fixture);
  await fixture.connection.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const name of names) {
      await fixture.connection.query(`DROP TABLE IF EXISTS \`${name}\``);
    }
  } finally {
    await fixture.connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

/** 0013 을 뺀 migration 폴더를 만들어 이전 배포 상태를 재현한다. */
function folderWithoutLastMigration(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "fos-blog-migrations-"));
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  const removed = journal.entries.pop();
  if (removed?.tag !== "0013_drop_study_tables") {
    throw new Error("마지막 migration 이 study 테이블 제거가 아닙니다.");
  }
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  return folder;
}

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("study 테이블 제거 migration", () => {
  let fixture: Fixture | undefined;
  let beforeRemoval: string[] = [];
  let afterRemoval: string[] = [];

  beforeAll(async () => {
    fixture = await createTestDatabase();
    await resetDatabase(fixture);

    const previous = folderWithoutLastMigration();
    try {
      await migrate(fixture.db, { migrationsFolder: previous });
    } finally {
      rmSync(previous, { recursive: true, force: true });
    }
    beforeRemoval = await tableNames(fixture);

    await migrate(fixture.db, { migrationsFolder: MIGRATIONS_FOLDER });
    afterRemoval = await tableNames(fixture);
  }, 120_000);

  afterAll(async () => {
    if (!fixture) return;
    await resetDatabase(fixture);
    await fixture.connection.end();
  });

  it("0012 까지 적용한 상태에는 13개 study 테이블이 있다", () => {
    expect(beforeRemoval.filter((name) => name.startsWith("study_"))).toEqual(STUDY_TABLES);
  });

  it("새 migration 은 13개 study 테이블만 지운다", () => {
    const removed = beforeRemoval.filter((name) => !afterRemoval.includes(name));
    expect(removed).toEqual(STUDY_TABLES);
    expect(afterRemoval.filter((name) => name.startsWith("study_"))).toEqual([]);
  });

  it("공개 블로그와 인증 테이블은 그대로 남는다", () => {
    for (const name of KEPT_TABLES) expect(afterRemoval).toContain(name);
  });

  it("migration 재실행이 멱등이다", async () => {
    await migrate(fixture!.db, { migrationsFolder: MIGRATIONS_FOLDER });
    expect(await tableNames(fixture!)).toEqual(afterRemoval);
  });

  it("빈 DB 에 모든 migration 을 처음부터 적용해도 study 테이블이 남지 않는다", async () => {
    await resetDatabase(fixture!);
    await migrate(fixture!.db, { migrationsFolder: MIGRATIONS_FOLDER });
    const present = await tableNames(fixture!);
    expect(present.filter((name) => name.startsWith("study_"))).toEqual([]);
    for (const name of KEPT_TABLES) expect(present).toContain(name);
  }, 60_000);
});
