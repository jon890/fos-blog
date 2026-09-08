"use client";

import { useEffect, useRef, useState } from "react";
import type { MaterialState } from "@/lib/study/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MaterialStateSaveResult =
  | { status: "saved"; state: MaterialState }
  | { status: "conflict"; latestState: MaterialState };

export type DesiredMaterialState = {
  expectedVersion: number;
  starred: boolean;
  read: boolean;
  note: string;
};

type Props = {
  state: MaterialState;
  onSave: (input: DesiredMaterialState) => Promise<MaterialStateSaveResult>;
};

function stateDescription(state: MaterialState): string {
  return `즐겨찾기 ${state.starred ? "예" : "아니오"}, 읽음 ${state.read ? "예" : "아니오"}, 메모 ${state.note || "없음"}`;
}

export function MaterialStateEditor({ state, onSave }: Props) {
  const [draft, setDraft] = useState(state);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [latestState, setLatestState] = useState<MaterialState | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setDraft(state);
    setLatestState(null);
  }, [state]);

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("저장하고 있습니다.");
    setLatestState(null);
    const input: DesiredMaterialState = {
      expectedVersion: state.version,
      starred: draft.starred,
      read: draft.read,
      note: draft.note,
    };
    try {
      const result = await onSave(input);
      if (result.status === "conflict") {
        setLatestState(result.latestState);
        setMessage("다른 곳에서 상태가 변경되었습니다. 최신 상태와 작성 중인 초안을 비교한 뒤 다시 저장해 주세요.");
        return;
      }
      setDraft(result.state);
      setMessage("저장했습니다.");
    } catch {
      setMessage("저장 여부를 확인하지 못했습니다. 작성 중인 내용은 유지됩니다.");
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <section aria-label="개인 상태 편집" className="space-y-3 border-t border-[var(--color-border-subtle)] pt-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Label htmlFor="material-starred" className="cursor-pointer"><input id="material-starred" type="checkbox" checked={draft.starred} disabled={pending} onChange={(event) => setDraft((current) => ({ ...current, starred: event.target.checked }))} /> 즐겨찾기</Label>
        <Label htmlFor="material-read" className="cursor-pointer"><input id="material-read" type="checkbox" checked={draft.read} disabled={pending} onChange={(event) => setDraft((current) => ({ ...current, read: event.target.checked }))} /> 읽음</Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="material-note">메모</Label>
        <Textarea id="material-note" value={draft.note} maxLength={5000} disabled={pending} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="일반 텍스트 메모를 남깁니다." />
        <p className="text-xs text-[var(--color-fg-secondary)]">{draft.note.length}/5000</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>{pending ? "저장 중…" : "상태와 메모 저장"}</Button>
        <p role="status" aria-live="polite" className="text-sm text-[var(--color-fg-secondary)]">{message}</p>
      </div>
      {latestState && <aside aria-label="최신 상태" className="rounded-md border border-[var(--color-warning)] p-3 text-sm"><p className="font-medium">최신 상태</p><p>{stateDescription(latestState)}</p><p className="mt-1 text-[var(--color-fg-secondary)]">작성 중인 초안은 그대로 남아 있습니다.</p></aside>}
    </section>
  );
}
