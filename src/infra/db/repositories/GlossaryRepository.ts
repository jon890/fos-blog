import { and, count, desc, eq, notInArray } from "drizzle-orm";
import {
  glossaryMentions,
  glossaryTerms,
  type GlossaryTerm,
  type NewGlossaryMention,
  type NewGlossaryTerm,
} from "../schema";
import type { DbInstance } from "./BaseRepository";

export type GlossaryRepositoryDb = Pick<
  DbInstance,
  "delete" | "select" | "transaction"
>;

export type MatchableGlossaryTerm = Pick<
  GlossaryTerm,
  "id" | "term" | "fullName" | "aliases" | "summary" | "caseSensitive"
>;

export type GlossaryDefinition = Pick<
  GlossaryTerm,
  | "id"
  | "term"
  | "fullName"
  | "aliases"
  | "summary"
  | "description"
  | "caseSensitive"
  | "references"
>;

export type GlossaryPageType = "post" | "category-readme";

export type GlossaryMentionInput = Pick<
  NewGlossaryMention,
  "termId" | "pageTitle" | "pageUpdatedAt"
>;

export type GlossaryMentionProjection = {
  termId: string;
  pageType: GlossaryPageType;
  pagePath: string;
  pageTitle: string;
  pageUpdatedAt: Date | null;
};

export class GlossaryRepository {
  constructor(private db: GlossaryRepositoryDb) {}

  async replaceTerms(terms: NewGlossaryTerm[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (terms.length === 0) {
        await tx.delete(glossaryTerms);
        return;
      }

      await tx
        .delete(glossaryTerms)
        .where(notInArray(glossaryTerms.id, terms.map((term) => term.id)));

      for (const term of terms) {
        await tx
          .insert(glossaryTerms)
          .values(term)
          .onDuplicateKeyUpdate({
            set: {
              term: term.term,
              fullName: term.fullName,
              aliases: term.aliases,
              summary: term.summary,
              description: term.description,
              caseSensitive: term.caseSensitive,
              references: term.references,
            },
          });
      }
    });
  }

  async countTerms(): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(glossaryTerms);
    return result[0]?.value ?? 0;
  }

  async replaceAllMentions(rows: NewGlossaryMention[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(glossaryMentions);
      if (rows.length > 0) {
        await tx.insert(glossaryMentions).values(rows);
      }
    });
  }

  async replacePageMentions(
    pageType: GlossaryPageType,
    pagePath: string,
    rows: GlossaryMentionInput[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(glossaryMentions)
        .where(
          and(
            eq(glossaryMentions.pageType, pageType),
            eq(glossaryMentions.pagePath, pagePath),
          ),
        );
      if (rows.length > 0) {
        await tx.insert(glossaryMentions).values(
          rows.map((row) => ({ ...row, pageType, pagePath })),
        );
      }
    });
  }

  async deletePageMentions(
    pageType: GlossaryPageType,
    pagePath: string,
  ): Promise<void> {
    await this.db
      .delete(glossaryMentions)
      .where(
        and(
          eq(glossaryMentions.pageType, pageType),
          eq(glossaryMentions.pagePath, pagePath),
        ),
      );
  }

  async countMentions(): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(glossaryMentions);
    return result[0]?.value ?? 0;
  }

  async getMentions(): Promise<GlossaryMentionProjection[]> {
    const rows = await this.db
      .select({
        termId: glossaryMentions.termId,
        pageType: glossaryMentions.pageType,
        pagePath: glossaryMentions.pagePath,
        pageTitle: glossaryMentions.pageTitle,
        pageUpdatedAt: glossaryMentions.pageUpdatedAt,
      })
      .from(glossaryMentions)
      .orderBy(desc(glossaryMentions.pageUpdatedAt));

    return rows as GlossaryMentionProjection[];
  }

  async getMatchableTerms(): Promise<MatchableGlossaryTerm[]> {
    return this.db
      .select({
        id: glossaryTerms.id,
        term: glossaryTerms.term,
        fullName: glossaryTerms.fullName,
        aliases: glossaryTerms.aliases,
        summary: glossaryTerms.summary,
        caseSensitive: glossaryTerms.caseSensitive,
      })
      .from(glossaryTerms);
  }

  async getDefinitions(): Promise<GlossaryDefinition[]> {
    return this.db
      .select({
        id: glossaryTerms.id,
        term: glossaryTerms.term,
        fullName: glossaryTerms.fullName,
        aliases: glossaryTerms.aliases,
        summary: glossaryTerms.summary,
        description: glossaryTerms.description,
        caseSensitive: glossaryTerms.caseSensitive,
        references: glossaryTerms.references,
      })
      .from(glossaryTerms);
  }
}
