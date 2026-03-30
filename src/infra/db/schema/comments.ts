import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

// 댓글 테이블
export const comments = mysqlTable(
  "comments",
  {
    id: int("id").primaryKey().autoincrement(),
    postSlug: varchar("post_slug", { length: 500 }).notNull(), // 포스트 경로
    nickname: varchar("nickname", { length: 100 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(), // bcrypt 해시
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [index("post_slug_idx").on(table.postSlug)]
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
