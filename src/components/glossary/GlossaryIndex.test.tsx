// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GlossaryIndex,
  type GlossaryIndexItem,
  type GlossaryMentionView,
} from "./GlossaryIndex";

afterEach(cleanup);

const pageSource = readFileSync(
  join(__dirname, "../../app/glossary/page.tsx"),
  "utf-8",
);

const baseItems: GlossaryIndexItem[] = [
  makeItem({
    id: "llm",
    term: "LLM",
    fullName: "Large Language Model",
    aliases: ["언어 모델"],
    summary: "대규모 데이터로 학습한 생성 모델",
  }),
  makeItem({
    id: "virtual-machine",
    term: "가상 머신",
    fullName: "Virtual Machine",
    aliases: ["VM"],
    summary: "격리된 컴퓨팅 환경",
  }),
];

describe("GlossaryIndex", () => {
  it("term, fullName, aliases, summary를 대소문자 구분 없이 검색하고 결과 색인을 갱신한다", async () => {
    const user = userEvent.setup();
    render(<GlossaryIndex items={baseItems} />);

    expect(screen.getByRole("navigation", { name: "용어 색인" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "L" })).toHaveProperty(
      "hash",
      "#llm",
    );
    expect(screen.getByRole("link", { name: "ㄱ" })).toHaveProperty(
      "hash",
      "#virtual-machine",
    );

    await user.type(screen.getByRole("searchbox", { name: "용어 검색" }), "vm");

    expect(screen.getByText("1개의 검색 결과")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "LLM" })).toBeNull();
    expect(screen.getByRole("heading", { name: "가상 머신" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "L" })).toBeNull();
    expect(screen.getByRole("link", { name: "ㄱ" })).toBeTruthy();
  });

  it("용어 0개 상태와 검색 결과 0개 상태를 다른 안내와 다음 행동으로 표시한다", async () => {
    const { rerender } = render(<GlossaryIndex items={[]} />);

    expect(screen.getByText("아직 등록된 용어가 없습니다")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();

    rerender(<GlossaryIndex items={baseItems} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "용어 검색" }), "없는용어");

    expect(screen.getByText("검색 결과가 없습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "전체 용어 보기" })).toBeTruthy();
    expect(screen.getByText("0개의 검색 결과")).toBeTruthy();
  });

  it("언급 페이지는 최근 5개를 먼저 표시하고 버튼으로 나머지를 펼친다", async () => {
    const mentions = Array.from({ length: 6 }, (_, index) =>
      makeMention(index),
    );
    const user = userEvent.setup();
    render(
      <GlossaryIndex
        items={[
          {
            ...baseItems[0],
            mentions,
          },
        ]}
      />,
    );

    expect(screen.getAllByRole("link", { name: /문맥/ })).toHaveLength(5);
    expect(screen.queryByText("문맥 6")).toBeNull();

    await user.click(screen.getByRole("button", { name: "1개 더 보기" }));

    expect(screen.getAllByRole("link", { name: /문맥/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "최근 5개만 보기" })).toHaveProperty(
      "ariaExpanded",
      "true",
    );
  });
});

describe("GlossaryPage source contracts", () => {
  it("description renderer의 glossary 변환을 끄고 서버 렌더 결과를 전달한다", () => {
    expect(pageSource).toContain("const description = await MarkdownRenderer({");
    expect(pageSource).toContain("enableGlossary: false");
    expect(pageSource).toContain("<GlossaryIndex items={items} />");
  });

  it("metadata, ISR, 구조화 warning과 빈 목록 fallback을 고정한다", () => {
    expect(pageSource).toContain("export const revalidate = 60");
    expect(pageSource).toContain("canonical: `${siteUrl}/glossary`");
    expect(pageSource).toContain("openGraph:");
    expect(pageSource).toContain('let terms: GlossaryPageTerm[] = []');
    expect(pageSource).toContain('operation: "get-glossary-page-data"');
    expect(pageSource).toContain("log.warn(");
  });
});

function makeItem(
  metadata: GlossaryIndexItem["metadata"],
): GlossaryIndexItem {
  return {
    metadata,
    description: <p>{metadata.term} 설명</p>,
    mentions: [],
    references: [],
  };
}

function makeMention(index: number): GlossaryMentionView {
  const number = index + 1;
  return {
    pageType: index % 2 === 0 ? "post" : "category-readme",
    pageTitle: `문맥 ${number}`,
    updatedAtLabel: `2026.01.0${number}`,
    url: index % 2 === 0 ? `/posts/context-${number}` : `/category/context-${number}`,
  };
}
