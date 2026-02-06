import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
} from "drizzle-orm/mysql-core";

// 동기화 로그 테이블
export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").primaryKey().autoincrement(),
  status: varchar("status", { length: 50 }).notNull(), // 'success' | 'failed'
  postsAdded: int("posts_added").default(0),
  postsUpdated: int("posts_updated").default(0),
  postsDeleted: int("posts_deleted").default(0),
  error: text("error"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
