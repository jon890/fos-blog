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

// 카테고리 테이블
export const categories = mysqlTable(
  "categories",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    icon: varchar("icon", { length: 50 }),
    postCount: int("post_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [index("slug_idx").on(table.slug)]
);

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

// 타입 추론
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
