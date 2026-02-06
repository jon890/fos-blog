import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  index,
  date,
} from "drizzle-orm/mysql-core";

// 방문 로그 테이블 (IP 중복 방지용)
export const visitLogs = mysqlTable(
  "visit_logs",
  {
    id: int("id").primaryKey().autoincrement(),
    pagePath: varchar("page_path", { length: 500 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(), // SHA-256 해시
    visitedDate: date("visited_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("visit_page_ip_date_idx").on(
      table.pagePath,
      table.ipHash,
      table.visitedDate
    ),
  ]
);

export type VisitLog = typeof visitLogs.$inferSelect;
export type NewVisitLog = typeof visitLogs.$inferInsert;
