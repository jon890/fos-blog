import { StudyLibrary } from "@/components/study/StudyLibrary";
import { requireAdminPage } from "@/lib/admin/session";
import {
  getStudyMaterialAction,
  listStudyMaterialsAction,
  listStudySourcesAction,
  updateStudyMaterialStateAction,
} from "./actions";

export default async function StudyPage() {
  await requireAdminPage();
  return (
    <StudyLibrary
      listMaterials={listStudyMaterialsAction}
      listSources={listStudySourcesAction}
      getMaterial={getStudyMaterialAction}
      saveMaterialState={updateStudyMaterialStateAction}
    />
  );
}
