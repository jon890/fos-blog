import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  index,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// 포스트 테이블
export const posts = mysqlTable(
  "posts",
  {
    id: int("id").primaryKey().autoincrement(),
    title: varchar("title", { length: 500 }).notNull(),
    path: varchar("path", { length: 500 }).notNull().unique(), // MySQL 인덱스 키 제한으로 500자로 제한
    slug: varchar("slug", { length: 500 }).notNull(),
    category: varchar("category", { length: 255 }).notNull(),
    subcategory: varchar("subcategory", { length: 255 }),
    folders: json("folders").$type<string[]>().default([]), // n-depth 폴더 경로 배열
    content: text("content"),
    description: text("description"),
    sha: varchar("sha", { length: 64 }), // GitHub file SHA for change detection
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("category_idx").on(table.category),
    index("slug_idx").on(table.slug),
  ]
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
