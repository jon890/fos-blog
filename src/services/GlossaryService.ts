import { getDb } from "@/infra/db";
import {
  GlossaryRepository,
  type GlossaryDefinition,
  type GlossaryMentionProjection,
  type MatchableGlossaryTerm,
} from "@/infra/db/repositories/GlossaryRepository";

type GlossaryRepo = Pick<
  GlossaryRepository,
  "getDefinitions" | "getMatchableTerms" | "getMentions"
>;

export type GlossaryPageMention = GlossaryMentionProjection & {
  url: string;
};

export type GlossaryPageTerm = GlossaryDefinition & {
  mentions: GlossaryPageMention[];
};

export type GlossaryPageData = {
  terms: GlossaryPageTerm[];
};

export class GlossaryService {
  constructor(private glossaryRepo: GlossaryRepo) {}

  getMatchableTerms(): Promise<MatchableGlossaryTerm[]> {
    return this.glossaryRepo.getMatchableTerms();
  }

  async getGlossaryPageData(): Promise<GlossaryPageData> {
    const [definitions, mentions] = await Promise.all([
      this.glossaryRepo.getDefinitions(),
      this.glossaryRepo.getMentions(),
    ]);
    const mentionsByTerm = new Map<string, GlossaryPageMention[]>();

    for (const mention of mentions) {
      const group = mentionsByTerm.get(mention.termId) ?? [];
      group.push({ ...mention, url: createMentionUrl(mention) });
      mentionsByTerm.set(mention.termId, group);
    }

    return {
      terms: definitions.map((definition) => ({
        ...definition,
        mentions: mentionsByTerm.get(definition.id) ?? [],
      })),
    };
  }
}

export function createGlossaryService(): GlossaryService {
  return new GlossaryService(new GlossaryRepository(getDb()));
}

function createMentionUrl(mention: GlossaryMentionProjection): string {
  const sourcePath =
    mention.pageType === "category-readme"
      ? mention.pagePath.split("/").slice(0, -1).join("/")
      : mention.pagePath;
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  return mention.pageType === "post"
    ? `/posts/${encodedPath}`
    : `/category/${encodedPath}`;
}
