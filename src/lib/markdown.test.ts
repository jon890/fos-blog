import { describe, expect, it } from "vitest";
import {
  extractDescription,
  extractTitle,
  generateTableOfContents,
  getReadingTime,
  parseFrontMatter,
  stripLeadingH1,
} from "./markdown";

// ===== parseFrontMatter =====
describe("parseFrontMatter", () => {
  it("프론트매터가 없으면 빈 객체와 원본 콘텐츠를 반환한다", () => {
    const content = "# 제목\n\n본문 내용";
    const result = parseFrontMatter(content);
    expect(result.frontMatter).toEqual({});
    expect(result.content).toBe(content);
  });

  it("프론트매터 키-값을 파싱한다", () => {
    const content = `---
title: 테스트 제목
date: 2024-01-15
---

본문`;
    const { frontMatter, content: body } = parseFrontMatter(content);
    expect(frontMatter.title).toBe("테스트 제목");
    expect(frontMatter.date).toBe("2024-01-15");
    expect(body.trim()).toBe("본문");
  });

  it("큰따옴표로 감싸진 값에서 따옴표를 제거한다", () => {
    const content = `---
title: "따옴표 제목"
---
`;
    const { frontMatter } = parseFrontMatter(content);
    expect(frontMatter.title).toBe("따옴표 제목");
  });

  it("작은따옴표로 감싸진 값에서 따옴표를 제거한다", () => {
    const content = `---
title: '작은따옴표 제목'
---
`;
    const { frontMatter } = parseFrontMatter(content);
    expect(frontMatter.title).toBe("작은따옴표 제목");
  });

  it("배열 값을 파싱한다", () => {
    const content = `---
tags: [java, spring, backend]
---
`;
    const { frontMatter } = parseFrontMatter(content);
    expect(frontMatter.tags).toEqual(["java", "spring", "backend"]);
  });

  it("프론트매터를 제거한 나머지 콘텐츠를 반환한다", () => {
    const content = `---
title: 제목
---

# 본문 헤딩

본문 내용`;
    const { content: body } = parseFrontMatter(content);
    expect(body).not.toContain("---");
    expect(body).not.toContain("title:");
    expect(body).toContain("# 본문 헤딩");
  });
});

// ===== extractTitle =====
describe("extractTitle", () => {
  it("프론트매터 title을 우선적으로 반환한다", () => {
    const content = `---
title: 프론트매터 제목
---

# H1 제목`;
    expect(extractTitle(content)).toBe("프론트매터 제목");
  });

  it("프론트매터가 없으면 첫 번째 h1을 반환한다", () => {
    const content = "# 첫 번째 헤딩\n\n## 두 번째 헤딩";
    expect(extractTitle(content)).toBe("첫 번째 헤딩");
  });

  it("제목이 없으면 null을 반환한다", () => {
    const content = "본문만 있는 내용\n\n다음 단락";
    expect(extractTitle(content)).toBeNull();
  });

  it("h2만 있을 때 null을 반환한다", () => {
    const content = "## h2 헤딩";
    expect(extractTitle(content)).toBeNull();
  });
});

// ===== extractDescription =====
describe("extractDescription", () => {
  it("프론트매터 description을 반환한다", () => {
    const content = `---
description: 메타 설명
---

본문`;
    expect(extractDescription(content)).toBe("메타 설명");
  });

  it("헤더와 마크다운 문법을 제거하고 텍스트를 반환한다", () => {
    const content = "# 제목\n\n**굵은 글씨** 그리고 _이탤릭_ 텍스트";
    const result = extractDescription(content);
    expect(result).not.toContain("**");
    expect(result).not.toContain("_");
    expect(result).not.toContain("# 제목");
    expect(result).toContain("굵은 글씨");
  });

  it("링크 텍스트만 남기고 URL을 제거한다", () => {
    const content = "[링크 텍스트](https://example.com)";
    expect(extractDescription(content)).toBe("링크 텍스트");
  });

  it("maxLength를 초과하면 잘라서 ...을 붙인다", () => {
    const longText = "a ".repeat(200);
    const result = extractDescription(longText, 50);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
  });

  it("maxLength 이내면 ...을 붙이지 않는다", () => {
    const content = "짧은 내용";
    const result = extractDescription(content, 200);
    expect(result.endsWith("...")).toBe(false);
    expect(result).toBe("짧은 내용");
  });
});

// ===== getReadingTime =====
describe("getReadingTime", () => {
  it("200단어는 1분으로 계산한다", () => {
    const words = "word ".repeat(200).trim();
    expect(getReadingTime(words)).toBe(1);
  });

  it("201단어는 2분으로 올림한다", () => {
    const words = "word ".repeat(201).trim();
    expect(getReadingTime(words)).toBe(2);
  });

  it("400단어는 2분이다", () => {
    const words = "word ".repeat(400).trim();
    expect(getReadingTime(words)).toBe(2);
  });

  it("최소 1분을 반환한다 (빈 문자열도 포함)", () => {
    expect(getReadingTime("")).toBe(1);
    expect(getReadingTime("한 단어")).toBe(1);
  });
});

// ===== generateTableOfContents =====
describe("generateTableOfContents", () => {
  it("헤딩이 없으면 빈 배열을 반환한다", () => {
    expect(generateTableOfContents("본문만 있는 내용")).toEqual([]);
  });

  it("h1, h2, h3 레벨을 올바르게 파싱한다", () => {
    const content = `# H1 제목
## H2 제목
### H3 제목`;
    const toc = generateTableOfContents(content);
    expect(toc).toHaveLength(3);
    expect(toc[0]).toMatchObject({ level: 1, text: "H1 제목" });
    expect(toc[1]).toMatchObject({ level: 2, text: "H2 제목" });
    expect(toc[2]).toMatchObject({ level: 3, text: "H3 제목" });
  });

  it("slug를 소문자 kebab-case로 생성한다", () => {
    const content = "## Hello World";
    const [item] = generateTableOfContents(content);
    expect(item.slug).toBe("hello-world");
  });

  it("한글 헤딩의 slug를 생성한다", () => {
    const content = "## 한글 제목";
    const [item] = generateTableOfContents(content);
    expect(item.slug).toBeTruthy();
    expect(typeof item.slug).toBe("string");
  });

  it("중복 헤딩에 고유한 slug를 부여한다 (github-slugger 방식)", () => {
    const content = `## 같은 제목
## 같은 제목
## 같은 제목`;
    const toc = generateTableOfContents(content);
    const slugs = toc.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(3); // 모두 고유해야 함
    expect(slugs[0]).toBe("같은-제목");
    expect(slugs[1]).toBe("같은-제목-1");
    expect(slugs[2]).toBe("같은-제목-2");
  });

  it("본문 텍스트 중간의 #은 헤딩으로 인식하지 않는다", () => {
    const content = "태그: #javascript #react\n## 진짜 헤딩";
    const toc = generateTableOfContents(content);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("진짜 헤딩");
  });
});

// ===== stripLeadingH1 =====
describe("stripLeadingH1", () => {
  it("returns content unchanged when no leading h1", () => {
    const input = "## Section\n본문...";
    expect(stripLeadingH1(input)).toBe(input);
  });

  it("removes leading h1 and following blank lines", () => {
    const input = "# Title\n\n본문 내용";
    expect(stripLeadingH1(input)).toBe("본문 내용");
  });

  it("removes leading blank lines + h1 + trailing blank lines", () => {
    const input = "\n\n# Title\n\n\n본문";
    expect(stripLeadingH1(input)).toBe("본문");
  });

  it("returns empty string unchanged", () => {
    expect(stripLeadingH1("")).toBe("");
  });

  it("preserves mid-document h1", () => {
    const input = "본문 첫 단락\n\n# Mid Heading\n\n본문 이어서";
    expect(stripLeadingH1(input)).toBe(input);
  });

  it("does not remove leading h2", () => {
    const input = "## Only Section\n본문";
    expect(stripLeadingH1(input)).toBe(input);
  });

  it("does not remove h1 without space after hash (e.g. #main)", () => {
    const input = "#main\n본문";
    expect(stripLeadingH1(input)).toBe(input);
  });
});
