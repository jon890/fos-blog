import { getRepositories } from "@/infra/db/repositories";
import { categoryIcons } from "@/infra/db/constants";
import { FolderSidebar } from "@/components/FolderSidebar";
import { computeFolderPaths } from "@/lib/path-utils";

export async function FolderSidebarWrapper() {
  try {
    const { post } = getRepositories();
    const [postPaths, posts] = await Promise.all([
      post.getAllPostPaths(),
      post.getAllPostsForSidebar(),
    ]);

    return (
      <FolderSidebar
        folderPaths={computeFolderPaths(postPaths)}
        posts={posts}
        categoryIcons={categoryIcons}
      />
    );
  } catch {
    return null;
  }
}
