"use client";

import { useRef, useState } from "react";
import {
  importCommitResponseSchema,
  importDryRunRequestSchema,
  importDryRunResponseSchema,
  studyErrorResponseSchema,
  type ImportCommitRequest,
  type ImportCommitResult,
  type ImportDryRunRequest,
  type ImportDryRunResult,
} from "@/lib/study/contracts";

const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

type ImportPanelErrorCode = "unauthenticated" | "import-changed" | "failed";

class ImportPanelError extends Error {
  constructor(readonly code: ImportPanelErrorCode, message: string) {
    super(message);
  }
}

type Props = {
  onDryRun?: (payload: ImportDryRunRequest) => Promise<ImportDryRunResult>;
  onCommit?: (payload: ImportCommitRequest) => Promise<ImportCommitResult>;
};

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsText(file);
  });
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ImportPanelError("failed", "서버 응답을 읽지 못했습니다.");
  }
}

async function requestJson(path: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ImportPanelError("failed", "서버에 연결하지 못했습니다.");
  }
  if (response.status === 401) throw new ImportPanelError("unauthenticated", "로그인이 만료되었습니다. 다시 로그인한 뒤 가져오기를 진행해 주세요.");
  const value = await readResponse(response);
  if (!response.ok) {
    const error = studyErrorResponseSchema.safeParse(value);
    if (error.success && error.data.error.code === "IMPORT_CHANGED") {
      throw new ImportPanelError("import-changed", "미리보기 이후 이력이 변경되었습니다. 새 미리보기를 실행해 주세요.");
    }
    throw new ImportPanelError("failed", error.success ? error.data.error.message : "가져오기를 처리하지 못했습니다.");
  }
  return value;
}

async function defaultDryRun(payload: ImportDryRunRequest): Promise<ImportDryRunResult> {
  const parsed = importDryRunResponseSchema.safeParse(await requestJson("/api/study/v1/imports/dry-run", payload));
  if (!parsed.success) throw new ImportPanelError("failed", "미리보기 응답 형식이 올바르지 않습니다.");
  return parsed.data;
}

async function defaultCommit(payload: ImportCommitRequest): Promise<ImportCommitResult> {
  const parsed = importCommitResponseSchema.safeParse(await requestJson("/api/study/v1/imports/commit", payload));
  if (!parsed.success) throw new ImportPanelError("failed", "가져오기 응답 형식이 올바르지 않습니다.");
  return parsed.data;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "가져오기를 처리하지 못했습니다.";
}

export function ImportPanel({ onDryRun = defaultDryRun, onCommit = defaultCommit }: Props) {
  const [payload, setPayload] = useState<ImportDryRunRequest | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportDryRunResult | null>(null);
  const [message, setMessage] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const commitInFlight = useRef(false);
  const selectionId = useRef(0);

  async function selectFile(file: File | undefined) {
    const id = ++selectionId.current;
    setPayload(null);
    setPreview(null);
    setMessage("");
    setFileName(file?.name ?? null);
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setMessage("가져오기 파일은 1 MiB 이하여야 합니다.");
      return;
    }
    try {
      const parsed = importDryRunRequestSchema.safeParse(JSON.parse(await readFile(file)));
      if (!parsed.success) {
        setMessage("가져오기 파일 형식이 올바르지 않습니다. importKey와 reports만 포함한 정규화 JSON 파일을 선택해 주세요.");
        return;
      }
      if (id === selectionId.current) {
        setPayload(parsed.data);
        setMessage("파일을 선택했습니다. 저장 전 미리보기를 실행해 주세요.");
      }
    } catch {
      if (id === selectionId.current) {
        setMessage("JSON 파일을 읽지 못했습니다. importKey와 reports만 포함한 정규화 JSON 파일을 선택해 주세요.");
      }
    }
  }

  async function previewImport() {
    if (!payload || isPreviewing) return;
    const id = selectionId.current;
    setIsPreviewing(true);
    setPreview(null);
    setMessage("미리보기를 만들고 있습니다.");
    try {
      const result = await onDryRun(payload);
      if (id !== selectionId.current) return;
      setPreview(result);
      setMessage("미리보기를 확인한 뒤 명시적으로 가져오기를 확정해 주세요.");
    } catch (error) {
      if (id === selectionId.current) setMessage(errorMessage(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function commitImport() {
    if (!payload || !preview || commitInFlight.current) return;
    commitInFlight.current = true;
    setIsCommitting(true);
    setMessage("가져오기를 확정하고 있습니다.");
    try {
      const result = await onCommit({ ...payload, previewHash: preview.previewHash, expectedHistoryVersion: preview.historyVersion });
      setPreview(null);
      setMessage(`가져오기를 완료했습니다. 이력 버전 ${result.historyVersion}`);
    } catch (error) {
      if (
        error instanceof ImportPanelError
        ? error.code === "import-changed"
        : typeof error === "object" && error !== null && "code" in error && error.code === "import-changed"
      ) setPreview(null);
      setMessage(errorMessage(error));
    } finally {
      setIsCommitting(false);
      commitInFlight.current = false;
    }
  }

  return (
    <section aria-labelledby="import-panel-title" className="space-y-5">
      <div><h1 id="import-panel-title" className="text-3xl font-semibold">추천 이력 가져오기</h1><p className="mt-2 text-sm text-[var(--color-fg-secondary)]">importKey와 reports만 담은 정규화 JSON 파일을 선택한 뒤, 미리보기를 확인하고 확정합니다.</p></div>
      <div className="space-y-2"><label htmlFor="import-file" className="font-medium">가져오기 JSON 파일</label><input id="import-file" type="file" accept="application/json,.json" onChange={(event) => void selectFile(event.target.files?.[0])} /><p className="text-sm text-[var(--color-fg-secondary)]">파일 크기는 1 MiB 이하입니다. 파일을 바꾸면 이전 미리보기는 폐기됩니다.</p>{fileName && <p className="text-sm">선택한 파일: {fileName}</p>}</div>
      <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!payload || isPreviewing || isCommitting} className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 disabled:opacity-60" onClick={() => void previewImport()}>{isPreviewing ? "미리보기 중…" : "미리보기"}</button><p role="status" aria-live="polite" className="text-sm text-[var(--color-fg-secondary)]">{message}</p></div>
      {preview && <section aria-label="가져오기 미리보기" className="space-y-3 rounded-lg border border-[var(--color-border-subtle)] p-4"><h2 className="text-xl font-semibold">가져오기 미리보기</h2><dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]"><dt>리포트</dt><dd>{preview.counts.reports}개</dd><dt>자료</dt><dd>{preview.counts.items}개</dd><dt>새 자료</dt><dd>{preview.counts.newMaterials}개</dd><dt>반복 자료</dt><dd>{preview.counts.repeatedContentKeys}개</dd><dt>기존 리포트</dt><dd>{preview.counts.existingReports}개</dd><dt>이력 버전</dt><dd>{preview.historyVersion}</dd></dl>{preview.warnings.length > 0 && <ul aria-label="가져오기 경고" className="list-disc pl-5 text-sm">{preview.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>}<button type="button" disabled={isCommitting || isPreviewing} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60" onClick={() => void commitImport()}>{isCommitting ? "가져오는 중…" : "가져오기 확정"}</button></section>}
    </section>
  );
}
