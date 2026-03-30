import { getDbQueries } from "@/db/queries";
import { categoryIcons } from "@/db/constants";
import { FolderSidebar } from "@/components/FolderSidebar";

export async function FolderSidebarWrapper() {
  const dbQueries = getDbQueries();
  if (!dbQueries) return null;

  const [folderPaths, posts] = await Promise.all([
    dbQueries.getAllFolderPaths(),
    dbQueries.getAllPostsForSidebar(),
  ]);

  return (
    <FolderSidebar
      folderPaths={folderPaths}
      posts={posts}
      categoryIcons={categoryIcons}
    />
  );
}
