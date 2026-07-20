import { boolean, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export type GlossaryReference = {
  label: string;
  url: string;
};

export const glossaryTerms = mysqlTable("glossary_terms", {
  id: varchar("id", { length: 128 }).primaryKey(),
  term: varchar("term", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 500 }),
  aliases: json("aliases").$type<string[]>().notNull().default([]),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  references: json("references")
    .$type<GlossaryReference[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type NewGlossaryTerm = typeof glossaryTerms.$inferInsert;
