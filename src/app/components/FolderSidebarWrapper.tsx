import { getRepositories } from "@/infra/db/repositories";
import { categoryIcons } from "@/infra/db/constants";
import { FolderSidebar } from "@/components/FolderSidebar";

export async function FolderSidebarWrapper() {
  try {
    const { post } = getRepositories();
    const [postPaths, posts] = await Promise.all([
      post.getAllPostPaths(),
      post.getAllPostsForSidebar(),
    ]);
    const folderPathSet = new Set<string>();
    for (const p of postPaths) {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) {
        folderPathSet.add(parts.slice(0, i).join("/"));
      }
    }
    const folderPaths = Array.from(folderPathSet)
      .sort()
      .map((p) => p.split("/"));

    return (
      <FolderSidebar
        folderPaths={folderPaths}
        posts={posts}
        categoryIcons={categoryIcons}
      />
    );
  } catch {
    return null;
  }
}
