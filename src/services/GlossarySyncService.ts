import type { GlossaryRepository } from "@/infra/db/repositories/GlossaryRepository";
import type {
  GlossaryMentionInput,
  GlossaryPageType,
} from "@/infra/db/repositories/GlossaryRepository";
import type { FolderRepository } from "@/infra/db/repositories/FolderRepository";
import type { PostRepository } from "@/infra/db/repositories/PostRepository";
import type { ChangedFile } from "@/infra/github/api";
import type { GlossaryMatcherTerm } from "@/lib/glossary-matcher";
import { extractTitle, parseFrontMatter } from "@/lib/markdown";
import { scanGlossaryMentions } from "./glossary-mention-scanner";
import { parseGlossaryFile } from "./glossary-schema";
import type { SyncedPageChange } from "./PostSyncService";

const GLOSSARY_PATH = "glossary.json";

type GithubApi = {
  getFileContent: (
    path: string,
  ) => Promise<{ content: string; sha: string } | null>;
};

type GlossaryRepo = Pick<
  GlossaryRepository,
  | "countMentions"
  | "countTerms"
  | "deletePageMentions"
  | "getMatchableTerms"
  | "replaceAllMentions"
  | "replacePageMentions"
  | "replaceTerms"
>;
type PostRepo = Pick<
  PostRepository,
  "getActiveMentionSource" | "getActiveMentionSources"
>;
type FolderRepo = Pick<
  FolderRepository,
  "getReadmeMentionSource" | "getReadmeMentionSources"
>;

export type GlossarySyncMode = "full" | "incremental";

export type GlossaryDefinitionSyncResult = {
  definitionsChanged: boolean;
  terms: number;
};

export type GlossaryMentionSyncResult = {
  mentions: number;
  pagesReindexed: number;
};

export type GlossaryMentionSyncInput = {
  definitionsChanged: boolean;
  changedPosts: SyncedPageChange[];
  changedReadmes: SyncedPageChange[];
};

export class GlossarySyncService {
  constructor(
    private glossaryRepo: GlossaryRepo,
    private githubApi: GithubApi,
    private postRepo: PostRepo,
    private folderRepo: FolderRepo,
  ) {}

  async syncDefinitions(
    mode: GlossarySyncMode,
    changedFiles: ChangedFile[] = [],
  ): Promise<GlossaryDefinitionSyncResult> {
    if (mode === "incremental") {
      this.assertSourceWasNotRemoved(changedFiles);
      if (!changedFiles.some((file) => file.filename === GLOSSARY_PATH)) {
        return {
          definitionsChanged: false,
          terms: await this.glossaryRepo.countTerms(),
        };
      }
    }

    const source = await this.githubApi.getFileContent(GLOSSARY_PATH);
    if (!source) {
      throw new Error(`${GLOSSARY_PATH}을 찾을 수 없습니다.`);
    }

    let input: unknown;
    try {
      input = JSON.parse(source.content);
    } catch (error) {
      throw new Error(`${GLOSSARY_PATH} JSON 파싱에 실패했습니다.`, {
        cause: error,
      });
    }

    const glossary = parseGlossaryFile(input);
    await this.glossaryRepo.replaceTerms(glossary.terms);

    return {
      definitionsChanged: true,
      terms: glossary.terms.length,
    };
  }

  async syncMentions({
    definitionsChanged,
    changedPosts,
    changedReadmes,
  }: GlossaryMentionSyncInput): Promise<GlossaryMentionSyncResult> {
    const terms = await this.glossaryRepo.getMatchableTerms();

    if (definitionsChanged) {
      const posts = await this.postRepo.getActiveMentionSources();
      const readmes = await this.folderRepo.getReadmeMentionSources();
      const rows = [
        ...posts.flatMap((post) =>
          this.createMentionRows("post", post.path, post, terms),
        ),
        ...readmes.flatMap((readme) => {
          const pagePath = `${readme.path}/README.md`;
          return this.createMentionRows(
            "category-readme",
            pagePath,
            {
              content: readme.readme,
              title: this.getReadmeTitle(readme.readme, readme.path),
              updatedAt: readme.updatedAt,
            },
            terms,
          );
        }),
      ];

      await this.glossaryRepo.replaceAllMentions(rows);
      return {
        mentions: await this.glossaryRepo.countMentions(),
        pagesReindexed: posts.length + readmes.length,
      };
    }

    const pages = new Map<
      string,
      { pageType: GlossaryPageType; change: SyncedPageChange }
    >();
    changedPosts.forEach((change) =>
      pages.set(`post:${change.path}`, { pageType: "post", change }),
    );
    changedReadmes.forEach((change) =>
      pages.set(`category-readme:${change.path}`, {
        pageType: "category-readme",
        change,
      }),
    );

    for (const { pageType, change } of pages.values()) {
      if (change.operation === "delete") {
        await this.glossaryRepo.deletePageMentions(pageType, change.path);
        continue;
      }

      if (pageType === "post") {
        const post = await this.postRepo.getActiveMentionSource(change.path);
        if (!post) {
          await this.glossaryRepo.deletePageMentions(pageType, change.path);
          continue;
        }
        await this.glossaryRepo.replacePageMentions(
          pageType,
          change.path,
          this.createMentionRows(pageType, change.path, post, terms),
        );
        continue;
      }

      const folderPath = getReadmeFolderPath(change.path);
      const readme = await this.folderRepo.getReadmeMentionSource(folderPath);
      if (!readme) {
        await this.glossaryRepo.deletePageMentions(pageType, change.path);
        continue;
      }
      await this.glossaryRepo.replacePageMentions(
        pageType,
        change.path,
        this.createMentionRows(
          pageType,
          change.path,
          {
            content: readme.readme,
            title: this.getReadmeTitle(readme.readme, readme.path),
            updatedAt: readme.updatedAt,
          },
          terms,
        ),
      );
    }

    return {
      mentions: await this.glossaryRepo.countMentions(),
      pagesReindexed: pages.size,
    };
  }

  private createMentionRows(
    pageType: GlossaryPageType,
    pagePath: string,
    page: { content: string | null; title: string; updatedAt: Date | null },
    terms: readonly GlossaryMatcherTerm[],
  ): Array<GlossaryMentionInput & { pageType: GlossaryPageType; pagePath: string }> {
    if (!page.content) return [];
    return [...scanGlossaryMentions(page.content, terms)].map((termId) => ({
      termId,
      pageType,
      pagePath,
      pageTitle: page.title,
      pageUpdatedAt: page.updatedAt,
    }));
  }

  private getReadmeTitle(content: string, folderPath: string): string {
    const parsed = parseFrontMatter(content);
    return (
      extractTitle(content, parsed.frontMatter) ??
      folderPath.split("/").at(-1) ??
      folderPath
    );
  }

  private assertSourceWasNotRemoved(changedFiles: ChangedFile[]): void {
    const removed = changedFiles.some(
      (file) =>
        (file.filename === GLOSSARY_PATH && file.status === "removed") ||
        (file.status === "renamed" &&
          file.previous_filename === GLOSSARY_PATH &&
          file.filename !== GLOSSARY_PATH),
    );

    if (removed) {
      throw new Error(
        `${GLOSSARY_PATH} 삭제 또는 다른 경로로의 이름 변경은 허용되지 않습니다. 빈 terms 배열을 사용하세요.`,
      );
    }
  }
}

function getReadmeFolderPath(readmePath: string): string {
  return readmePath.split("/").slice(0, -1).join("/");
}
