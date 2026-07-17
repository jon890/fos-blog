export type GlossaryMatcherTerm = {
  id: string;
  term: string;
  aliases: string[];
  caseSensitive: boolean;
};

export type GlossaryMatch = {
  id: string;
  expression: string;
  start: number;
  end: number;
};

type Candidate = {
  id: string;
  expression: string;
  comparable: string;
  caseSensitive: boolean;
  canonical: boolean;
};

const ASCII_WORD_CHARACTER = /[A-Za-z0-9_]/;
const ASCII_ALPHANUMERIC = /[A-Za-z0-9]/;

export type GlossaryMatcher = {
  match(text: string, matchedIds?: Set<string>): GlossaryMatch[];
};

export function createGlossaryMatcher(
  terms: readonly GlossaryMatcherTerm[],
): GlossaryMatcher {
  const candidates = terms
    .flatMap((term) => [
      createCandidate(term, term.term, true),
      ...term.aliases.map((alias) => createCandidate(term, alias, false)),
    ])
    .sort(compareCandidates);

  return {
    match(text, matchedIds = new Set<string>()) {
      const matches: GlossaryMatch[] = [];
      const foldedText = text.toLowerCase();

      for (let index = 0; index < text.length; ) {
        const candidate = candidates.find(
          (item) =>
            !matchedIds.has(item.id) &&
            matchesAt(text, foldedText, index, item) &&
            hasValidAsciiBoundary(text, index, item.expression),
        );

        if (!candidate) {
          index += 1;
          continue;
        }

        const end = index + candidate.expression.length;
        matches.push({
          id: candidate.id,
          expression: text.slice(index, end),
          start: index,
          end,
        });
        matchedIds.add(candidate.id);
        index = end;
      }

      return matches;
    },
  };
}

export function matchGlossaryTerms(
  text: string,
  terms: readonly GlossaryMatcherTerm[],
  matchedIds?: Set<string>,
): GlossaryMatch[] {
  return createGlossaryMatcher(terms).match(text, matchedIds);
}

function createCandidate(
  term: GlossaryMatcherTerm,
  expression: string,
  canonical: boolean,
): Candidate {
  return {
    id: term.id,
    expression,
    comparable: term.caseSensitive ? expression : expression.toLowerCase(),
    caseSensitive: term.caseSensitive,
    canonical,
  };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return (
    right.expression.length - left.expression.length ||
    Number(right.canonical) - Number(left.canonical) ||
    compareIds(left.id, right.id)
  );
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function matchesAt(
  text: string,
  foldedText: string,
  index: number,
  candidate: Candidate,
): boolean {
  const source = candidate.caseSensitive ? text : foldedText;
  return source.startsWith(candidate.comparable, index);
}

function hasValidAsciiBoundary(
  text: string,
  index: number,
  expression: string,
): boolean {
  const first = expression[0];
  const last = expression[expression.length - 1];
  const before = text[index - 1];
  const after = text[index + expression.length];

  if (ASCII_ALPHANUMERIC.test(first) && before && ASCII_WORD_CHARACTER.test(before)) {
    return false;
  }
  if (ASCII_ALPHANUMERIC.test(last) && after && ASCII_WORD_CHARACTER.test(after)) {
    return false;
  }
  return true;
}
