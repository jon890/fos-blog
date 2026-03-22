import { getDbQueries } from "@/db/queries";
import { categoryIcons } from "@/db/constants";
import { FolderSidebar } from "@/components/FolderSidebar";

export async function FolderSidebarWrapper() {
  const dbQueries = getDbQueries();
  if (!dbQueries) return null;

  const folderPaths = await dbQueries.getAllFolderPaths();

  return (
    <FolderSidebar
      folderPaths={folderPaths}
      categoryIcons={categoryIcons}
    />
  );
}
