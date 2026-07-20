import { describe, expect, it } from "vitest";
import { createGlossaryMatcher, matchGlossaryTerms } from "./glossary-matcher";

const terms = [
  {
    id: "dependency-injection",
    term: "Dependency Injection",
    aliases: ["DI"],
    caseSensitive: false,
  },
  {
    id: "react-query",
    term: "React Query",
    aliases: [],
    caseSensitive: false,
  },
  {
    id: "react",
    term: "React",
    aliases: [],
    caseSensitive: false,
  },
];

describe("glossary matcher", () => {
  it("대표 용어와 별칭을 같은 id로 정규화하고 최초 한 번만 반환한다", () => {
    expect(matchGlossaryTerms("DI와 dependency injection, DI", terms)).toEqual([
      expect.objectContaining({ id: "dependency-injection", expression: "DI" }),
    ]);
  });

  it("겹치는 위치에서는 긴 표현을 우선한다", () => {
    expect(matchGlossaryTerms("React Query와 React", terms)).toEqual([
      expect.objectContaining({ id: "react-query", expression: "React Query" }),
      expect.objectContaining({ id: "react", expression: "React" }),
    ]);
  });

  it("ASCII word 내부 부분 일치는 막고 한글 조사 인접은 허용한다", () => {
    const matcher = createGlossaryMatcher(terms);

    expect(matcher.match("preReact Reactivity React는").map((match) => match.expression)).toEqual([
      "React",
    ]);
  });

  it("caseSensitive 설정을 지키고 비민감 비교는 locale에 의존하지 않는다", () => {
    const sensitiveTerms = [
      { id: "api", term: "API", aliases: [], caseSensitive: true },
      { id: "react", term: "React", aliases: [], caseSensitive: false },
    ];

    expect(matchGlossaryTerms("api API REACT", sensitiveTerms).map((match) => match.id)).toEqual([
      "api",
      "react",
    ]);
  });

  it("길이와 대표 여부가 같으면 id 오름차순으로 tie를 고정한다", () => {
    const tied = [
      { id: "z-term", term: "AB", aliases: [], caseSensitive: true },
      { id: "a-term", term: "AB", aliases: [], caseSensitive: true },
    ];

    expect(matchGlossaryTerms("AB", tied)[0]?.id).toBe("a-term");
  });
});
