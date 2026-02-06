import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  index,
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

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
