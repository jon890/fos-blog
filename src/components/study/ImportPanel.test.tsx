// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportDryRunRequest, ImportDryRunResult } from "@/lib/study/contracts";
import { studyContentKey } from "@/lib/study/url-identity";
import { ImportPanel } from "./ImportPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const payload: ImportDryRunRequest = {
  importKey: "legacy-2024",
  reports: [{ reportId: "legacy-report", generatedAt: "2024-01-01T00:00:00.000Z", topics: [{ topicKey: "backend-design", title: "백엔드 설계", careerQuestion: null, items: [{ contentKey: studyContentKey("https://example.test/article"), canonicalUrl: "https://example.test/article", sourceKey: "example", title: "자료", category: "techBlog", summary: null, reason: null, careerValue: null }] }] }],
};
const preview: ImportDryRunResult = {
  previewHash: "a".repeat(64), historyVersion: 4,
  counts: { reports: 1, items: 1, newMaterials: 1, repeatedContentKeys: 1, existingReports: 0 },
  warnings: [{ code: "REPEATED_CONTENT", message: "과거 리포트에 같은 자료가 있습니다." }],
};

function file(name: string, value: unknown): File {
  return new File([JSON.stringify(value)], name, { type: "application/json" });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

async function choose(value: File) {
  fireEvent.change(screen.getByLabelText("가져오기 JSON 파일"), { target: { files: [value] } });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("파일을 선택했습니다"));
}

describe("ImportPanel", () => {
  it("키보드로 파일 선택 뒤 미리보기와 명시적 확정을 수행하며 payload와 preview 값을 함께 보낸다", async () => {
    const onDryRun = vi.fn().mockResolvedValue(preview);
    const onCommit = vi.fn().mockResolvedValue({ importKey: payload.importKey, counts: preview.counts, historyVersion: 5 });
    render(<ImportPanel onDryRun={onDryRun} onCommit={onCommit} />);
    await choose(file("history.json", payload));
    const user = userEvent.setup();

    screen.getByRole("button", { name: "미리보기" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onDryRun).toHaveBeenCalledWith(payload));
    expect(screen.getByLabelText("가져오기 경고").textContent).toContain("같은 자료");
    screen.getByRole("button", { name: "가져오기 확정" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ ...payload, previewHash: preview.previewHash, expectedHistoryVersion: 4 }));
    expect(screen.getByRole("status").textContent).toContain("완료했습니다");
  });

  it("잘못된 JSON과 1 MiB 초과 파일은 미리보기 없이 오류로 표시한다", async () => {
    const onDryRun = vi.fn();
    render(<ImportPanel onDryRun={onDryRun} />);
    fireEvent.change(screen.getByLabelText("가져오기 JSON 파일"), { target: { files: [new File(["{"], "bad.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("JSON 파일을 읽지 못했습니다"));
    expect(screen.getByRole("button", { name: "미리보기" }).hasAttribute("disabled")).toBe(true);

    const oversized = new File(["x".repeat(1024 * 1024 + 1)], "large.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("가져오기 JSON 파일"), { target: { files: [oversized] } });
    expect(screen.getByRole("status").textContent).toContain("1 MiB 이하");
    expect(onDryRun).not.toHaveBeenCalled();
  });

  it("파일 변경은 stale preview를 폐기하고 새 미리보기가 있어야 확정할 수 있다", async () => {
    render(<ImportPanel onDryRun={vi.fn().mockResolvedValue(preview)} onCommit={vi.fn()} />);
    await choose(file("first.json", payload));
    await userEvent.click(screen.getByRole("button", { name: "미리보기" }));
    await screen.findByLabelText("가져오기 미리보기");
    await choose(file("second.json", { ...payload, importKey: "legacy-2025" }));
    expect(screen.queryByLabelText("가져오기 미리보기")).toBeNull();
    expect(screen.queryByRole("button", { name: "가져오기 확정" })).toBeNull();
  });

  it("미리보기 요청 중 파일을 바꾸면 이전 파일의 늦은 응답을 무시한다", async () => {
    let resolvePreview: (value: ImportDryRunResult) => void = () => undefined;
    const onDryRun = vi.fn().mockReturnValue(new Promise<ImportDryRunResult>((resolve) => {
      resolvePreview = resolve;
    }));
    render(<ImportPanel onDryRun={onDryRun} onCommit={vi.fn()} />);
    await choose(file("first.json", payload));
    await userEvent.click(screen.getByRole("button", { name: "미리보기" }));

    await choose(file("second.json", { ...payload, importKey: "legacy-2025" }));
    resolvePreview(preview);

    await waitFor(() => expect(onDryRun).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText("가져오기 미리보기")).toBeNull();
    expect(screen.queryByRole("button", { name: "가져오기 확정" })).toBeNull();
  });

  it("IMPORT_CHANGED와 401은 성공으로 바꾸지 않고 각각 새 미리보기와 로그인을 요구한다", async () => {
    let commitCount = 0;
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/study/v1/imports/dry-run") return Promise.resolve(json(preview));
      commitCount += 1;
      return Promise.resolve(commitCount === 1
        ? json({ error: { code: "IMPORT_CHANGED", message: "이력이 변경되었습니다.", requestId: "request-1" } }, 409)
        : json({ error: { code: "UNAUTHENTICATED", message: "로그인이 만료되었습니다.", requestId: "request-2" } }, 401));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ImportPanel />);
    await choose(file("history.json", payload));
    await userEvent.click(screen.getByRole("button", { name: "미리보기" }));
    await screen.findByRole("button", { name: "가져오기 확정" });
    await userEvent.click(screen.getByRole("button", { name: "가져오기 확정" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("이력이 변경"));
    expect(screen.queryByRole("button", { name: "가져오기 확정" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "미리보기" }));
    await screen.findByRole("button", { name: "가져오기 확정" });
    await userEvent.click(screen.getByRole("button", { name: "가져오기 확정" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("로그인이 만료"));
    expect(screen.getByRole("status").textContent).not.toContain("완료했습니다");
  });

  it("확정 중 중복 클릭은 commit을 한 번만 호출한다", async () => {
    let resolve: (value: { importKey: string; counts: ImportDryRunResult["counts"]; historyVersion: number }) => void = () => undefined;
    const onCommit = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ImportPanel onDryRun={vi.fn().mockResolvedValue(preview)} onCommit={onCommit} />);
    await choose(file("history.json", payload));
    await userEvent.click(screen.getByRole("button", { name: "미리보기" }));
    await screen.findByRole("button", { name: "가져오기 확정" });
    fireEvent.click(screen.getByRole("button", { name: "가져오기 확정" }));
    fireEvent.click(screen.getByRole("button", { name: "가져오는 중…" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    resolve({ importKey: payload.importKey, counts: preview.counts, historyVersion: 5 });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("완료했습니다"));
  });
});
