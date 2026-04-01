/**
 * post 경로 목록에서 중간 폴더 경로 집합을 계산한다.
 * 예: ["AI/RAG/intro.md", "AI/basics.md"] → [["AI"], ["AI", "RAG"]]
 */
export function computeFolderPaths(postPaths: string[]): string[][] {
  const folderPathSet = new Set<string>();
  for (const p of postPaths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) {
      folderPathSet.add(parts.slice(0, i).join("/"));
    }
  }
  return Array.from(folderPathSet)
    .sort()
    .map((p) => p.split("/"));
}
