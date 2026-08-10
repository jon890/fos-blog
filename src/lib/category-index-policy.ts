// ADR-036의 실측에서 경계 사례를 덜 제외하도록 선택한 최소 본문 크기다.
export const CATEGORY_INDEX_MIN_README_BYTES = 800;

// README가 짧어도 목록 자체의 탐색 가치를 인정하는 직속 글 임계다.
export const CATEGORY_INDEX_MIN_DIRECT_POSTS = 5;

interface CategoryIndexPolicyInput {
  readmeLength: number;
  directPostCount: number;
}

export function isCategoryIndexable({
  readmeLength,
  directPostCount,
}: CategoryIndexPolicyInput): boolean {
  return (
    readmeLength >= CATEGORY_INDEX_MIN_README_BYTES ||
    directPostCount >= CATEGORY_INDEX_MIN_DIRECT_POSTS
  );
}
