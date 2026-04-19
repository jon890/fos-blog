import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// 방문 통계 테이블 (집계용)
export const visitStats = mysqlTable(
  "visit_stats",
  {
    id: int("id").primaryKey().autoincrement(),
    pagePath: varchar("page_path", { length: 500 }).notNull(),
    visitCount: int("visit_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("visit_stats_page_path_idx").on(table.pagePath),
    index("visit_stats_count_path_idx").on(
      sql`${table.visitCount} DESC`,
      sql`${table.pagePath} ASC`,
    ),
  ]
);

export type VisitStat = typeof visitStats.$inferSelect;
export type NewVisitStat = typeof visitStats.$inferInsert;
