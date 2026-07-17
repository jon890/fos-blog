import type { GlossaryRepository } from "@/infra/db/repositories/GlossaryRepository";
import type { ChangedFile } from "@/infra/github/api";
import { parseGlossaryFile } from "./glossary-schema";

const GLOSSARY_PATH = "glossary.json";

type GithubApi = {
  getFileContent: (
    path: string,
  ) => Promise<{ content: string; sha: string } | null>;
};

type GlossaryRepo = Pick<GlossaryRepository, "countTerms" | "replaceTerms">;

export type GlossarySyncMode = "full" | "incremental";

export type GlossaryDefinitionSyncResult = {
  definitionsChanged: boolean;
  terms: number;
};

export class GlossarySyncService {
  constructor(
    private glossaryRepo: GlossaryRepo,
    private githubApi: GithubApi,
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
