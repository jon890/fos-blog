import { index, int, mysqlTable, timestamp, unique, varchar } from "drizzle-orm/mysql-core";
import { glossaryTerms } from "./glossaryTerms";

export const glossaryMentions = mysqlTable(
  "glossary_mentions",
  {
    id: int("id").primaryKey().autoincrement(),
    termId: varchar("term_id", { length: 128 })
      .notNull()
      .references(() => glossaryTerms.id, { onDelete: "cascade" }),
    pageType: varchar("page_type", { length: 32 }).notNull(),
    pagePath: varchar("page_path", { length: 500 }).notNull(),
    pageTitle: varchar("page_title", { length: 500 }).notNull(),
    pageUpdatedAt: timestamp("page_updated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("glossary_mentions_term_page_unique").on(
      table.termId,
      table.pageType,
      table.pagePath,
    ),
    index("glossary_mentions_term_updated_idx").on(
      table.termId,
      table.pageUpdatedAt,
    ),
  ],
);

export type GlossaryMention = typeof glossaryMentions.$inferSelect;
export type NewGlossaryMention = typeof glossaryMentions.$inferInsert;
