import type { Material } from "@/lib/study/contracts";
import { MaterialCard } from "./MaterialCard";
import type { DesiredMaterialState, MaterialStateSaveResult } from "./MaterialStateEditor";

type Props = {
  materials: Material[];
  onSaveState: (materialId: number, input: DesiredMaterialState) => Promise<MaterialStateSaveResult>;
};

export function MaterialList({ materials, onSaveState }: Props) {
  if (materials.length === 0) {
    return <p role="status" className="rounded-lg border border-dashed border-[var(--color-border-default)] p-6 text-center text-[var(--color-fg-secondary)]">조건에 맞는 자료가 없습니다.</p>;
  }
  return (
    <div role="feed" aria-label="학습자료 목록" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {materials.map((material) => <MaterialCard key={material.id} material={material} onSaveState={onSaveState} />)}
    </div>
  );
}
