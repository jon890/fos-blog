import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

// 폴더 테이블 (README 저장용)
export const folders = mysqlTable(
  "folders",
  {
    id: int("id").primaryKey().autoincrement(),
    path: varchar("path", { length: 500 }).notNull().unique(),
    readme: text("readme"), // README.md 내용
    sha: varchar("sha", { length: 64 }), // README file SHA
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [index("path_idx").on(table.path)]
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
