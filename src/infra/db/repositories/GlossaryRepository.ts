import { count, notInArray, sql } from "drizzle-orm";
import {
  glossaryTerms,
  type GlossaryTerm,
  type NewGlossaryTerm,
} from "../schema";
import { BaseRepository } from "./BaseRepository";

export type MatchableGlossaryTerm = Pick<
  GlossaryTerm,
  "id" | "term" | "aliases" | "summary" | "caseSensitive"
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

export class GlossaryRepository extends BaseRepository {
  async replaceTerms(terms: NewGlossaryTerm[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (terms.length === 0) {
        await tx.delete(glossaryTerms);
        return;
      }

      await tx
        .delete(glossaryTerms)
        .where(notInArray(glossaryTerms.id, terms.map((term) => term.id)));

      await tx
        .insert(glossaryTerms)
        .values(terms)
        .onDuplicateKeyUpdate({
          set: {
            term: sql`VALUES(${glossaryTerms.term})`,
            fullName: sql`VALUES(${glossaryTerms.fullName})`,
            aliases: sql`VALUES(${glossaryTerms.aliases})`,
            summary: sql`VALUES(${glossaryTerms.summary})`,
            description: sql`VALUES(${glossaryTerms.description})`,
            caseSensitive: sql`VALUES(${glossaryTerms.caseSensitive})`,
            references: sql`VALUES(${glossaryTerms.references})`,
          },
        });
    });
  }

  async countTerms(): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(glossaryTerms);
    return result[0]?.value ?? 0;
  }

  async getMatchableTerms(): Promise<MatchableGlossaryTerm[]> {
    return this.db
      .select({
        id: glossaryTerms.id,
        term: glossaryTerms.term,
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
