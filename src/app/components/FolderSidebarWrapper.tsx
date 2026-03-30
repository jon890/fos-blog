import { getRepositories } from "@/db/repositories";
import { categoryIcons } from "@/db/constants";
import { FolderSidebar } from "@/components/FolderSidebar";

export async function FolderSidebarWrapper() {
  try {
    const { folder, post } = getRepositories();
    const [folderPaths, posts] = await Promise.all([
      folder.getAllFolderPaths(),
      post.getAllPostsForSidebar(),
    ]);

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
