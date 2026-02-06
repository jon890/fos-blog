import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// 방문 통계 테이블 (집계용)
export const visitStats = mysqlTable(
  "visit_stats",
  {
    id: int("id").primaryKey().autoincrement(),
    pagePath: varchar("page_path", { length: 500 }).notNull(),
    visitCount: int("visit_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex("visit_stats_page_path_idx").on(table.pagePath)]
);

export type VisitStat = typeof visitStats.$inferSelect;
export type NewVisitStat = typeof visitStats.$inferInsert;
