# Phase 01 — 얇은 카테고리 색인 제외

**Execution profile**: standard
**Status**: completed

---

## 목표

내용이 얇은 카테고리 페이지를 `sitemap.xml`과 검색 색인에서 뺀다.
화면은 그대로 렌더하므로 사용자 탐색은 영향을 받지 않는다.

GitHub 이슈 [#199](https://github.com/jon890/fos-blog/issues/199)를 해결한다.
결정 근거와 임계값 산출 과정은 `docs/adr/036-thin-category-noindex.md`에 있다.

### 판정 규칙

`README` 길이가 **800바이트 이상**이거나 직속 글이 **5개 이상**이면 색인 대상이다.
둘 다 미달이면 제외한다.

### 지금 무엇이 문제인가

배포된 사이트에서 sitemap 100개를 검사한 결과 본문 500자 미만이 25개였고 그중 24개가 `/category`다.
같은 기준으로 글 44개를 검사했을 때는 미달이 하나도 없었다.
검색엔진은 사이트 단위로 품질을 평가하므로 얇은 페이지가 다수면 사이트 전체가 그렇게 보인다.

**범위 외**: 글과 정적 페이지의 색인 정책, `README` 내용 보강, `/tag`와 `/series`, 리디렉션, 문서 수정(이미 완료).

---

## 작업 항목 (5)

### 1. 판정 함수 추가

`src/lib/category-index-policy.ts`를 새로 만든다.

`{ readmeLength: number; directPostCount: number }`를 받아 색인 대상인지 boolean으로 반환하는 순수 함수를 export 한다.
임계값은 이 파일에 상수로 두고 왜 그 값인지 짧게 주석으로 남긴다. 근거는 ADR-036에 있다.

`path-utils.ts`에 넣지 않는 이유는 그 파일의 책임이 경로 계산이기 때문이다.
색인 정책을 섞으면 서로 다른 관심사가 한 파일에 들어간다.

**sitemap과 카테고리 페이지가 이 함수를 함께 쓰는 것이 이 phase의 핵심**이다.
각자 판정하면 sitemap에는 없는데 색인은 열려 있는 상태가 생겨 문제가 절반만 해결된다.
plan059에서 정규화 함수로 같은 교훈을 얻었다.

### 2. README 길이 조회 추가

`src/infra/db/repositories/FolderRepository.ts`에 폴더별 `README` 길이를 가져오는 메서드를 추가한다.

`README` 전문이 아니라 길이만 필요하므로 SQL의 `LENGTH`로 계산해 전송량을 줄인다.
반환 형태는 소문자로 정규화한 폴더 경로를 키로 쓰는 `Map<string, number>`로 한다.
저장된 경로의 대소문자가 달라도 sitemap의 소문자 canonical 경로와 같은 키로 조회되어야 한다.

기존 `getReadmeMentionSources()`를 재사용하지 않는다. 그 메서드는 용어집 역참조용이라 의미가 섞인다.
새 조회는 `src/infra/db/repositories/FolderRepository.test.ts`에서 SQL 결과를 소문자 경로와 숫자 길이로 매핑하는 동작을 고정한다.

### 3. sitemap에서 얇은 카테고리 제외

`src/app/sitemap.ts`를 고친다.

폴더별 `README` 길이와 직속 글 수를 구해 판정 함수를 통과한 카테고리만 남긴다.
직속 글 수는 이미 조회하는 `getAllPostsForSitemap()`의 `path`로 계산할 수 있어 추가 조회가 필요 없다.
직속 글은 그 폴더 바로 아래 글만 센다. 하위 폴더의 글은 포함하지 않는다.
`README` 길이 맵과 직속 글 수 맵은 모두 `normalizeCategoryPathSegments(...).join("/")`과 같은 소문자 경로 기준을 써서 대소문자 차이로 색인 대상을 잘못 빼지 않는다.

plan059가 넣은 URL 기준 중복 제거와 소문자 정규화는 그대로 유지한다.
필터는 그 앞 단계에 넣는다. 제외된 항목이 중복 제거 대상에 들어갈 이유가 없다.

### 4. 카테고리 페이지에 noindex 적용

`src/app/category/[...path]/page.tsx`의 `generateMetadata`를 고친다.

이 함수는 이미 `getCachedFolderContents`로 `{ folders, posts, readme }`를 받고 있어
추가 조회 없이 판정에 필요한 값을 갖고 있다.
직속 글 수는 `posts.length`를 쓴다.
`getCrossCategoryPosts()` 결과를 합친 `mergedPosts.length`는 직속 글이 아니므로 색인 판정에 쓰지 않는다.

얇으면 `robots: { index: false, follow: true }`를 넣는다.
`follow`를 유지하는 이유는 얇은 카테고리에도 글 링크가 있어 크롤러가 글에 도달하는 경로를 막을 이유가 없기 때문이다.
ADR-005가 리스트 페이지에 세운 원칙과 같다.

내용이 전혀 없는 카테고리에 이미 적용 중인 `index: false, follow: false`(`page.tsx:92` 부근)는 그대로 둔다.
그 분기가 먼저 반환되므로 순서를 바꾸지 않는다.

canonical과 화면 렌더는 건드리지 않는다.

### 5. 회귀 테스트 추가

`src/lib/category-index-policy.test.ts`를 새로 만든다.

- `README`가 임계 이상이면 글 수와 무관하게 색인 대상이다.
- 직속 글이 임계 이상이면 `README`가 없어도 색인 대상이다.
- 둘 다 미달이면 제외한다.
- 경계값에서 어느 쪽으로 갈리는지 고정한다.

`src/app/sitemap.test.ts`에 케이스를 추가한다. 이 파일은 plan059가 만들었다.

- 얇은 카테고리가 결과에 나타나지 않는다.
- 임계를 넘는 카테고리는 그대로 남는다.
- 기존 중복 제거와 소문자 정규화 동작이 유지된다.

`src/app/category/[...path]/page.test.ts`에 `generateMetadata` 케이스를 추가한다.

- 내용이 전혀 없으면 기존 `index: false, follow: false`를 유지한다.
- 없는 페이지가 아니지만 얇으면 `index: false, follow: true`를 반환한다.
- `README` 바이트나 직속 글 수가 임계에 닿으면 `robots` 제한을 반환하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/lib/category-index-policy.ts` | 신규. 판정 함수와 임계값 |
| `src/lib/category-index-policy.test.ts` | 신규. 판정 회귀 |
| `src/infra/db/repositories/FolderRepository.ts` | README 길이 조회 추가 |
| `src/infra/db/repositories/FolderRepository.test.ts` | README 길이 맵 회귀 추가 |
| `src/app/sitemap.ts` | 얇은 카테고리 필터 |
| `src/app/sitemap.test.ts` | 필터 회귀 추가 |
| `src/app/category/[...path]/page.tsx` | 얇으면 noindex |
| `src/app/category/[...path]/page.test.ts` | 메타데이터 robots 회귀 추가 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test src/lib/category-index-policy.test.ts
pnpm test src/infra/db/repositories/FolderRepository.test.ts
pnpm test src/app/sitemap.test.ts
pnpm test 'src/app/category/[...path]/page.test.ts'
pnpm lint
pnpm type-check
pnpm test
pnpm build
git diff --check
```

기대값: 위 명령이 모두 종료 코드 0이다.

```bash
# cwd: /Users/nhn/personal/fos-blog
rg -n "readmeLength|directPostCount" src/app/sitemap.ts "src/app/category/[...path]/page.tsx"
```

기대값: 두 파일 모두 `category-index-policy`의 판정 함수를 거쳐 색인 여부를 정한다.
어느 한쪽이 자체 기준으로 판정하는 코드가 없다.

배포 후 다음으로 실제 효과를 확인한다. 배포 전에는 실행할 수 없다.

```bash
# cwd: /Users/nhn/personal/fos-blog
python3 ~/.claude/skills/adsense-readiness/scripts/thin_page_audit.py \
  --sitemap https://blog.fosworld.co.kr/sitemap.xml --threshold 500 --limit 100
```

기대값: `/category` 라우트의 얇은 페이지 수가 24개에서 크게 줄어든다.
`/posts`는 지금처럼 0개를 유지한다.

검증이 모두 통과하면 `tasks/plan060-thin-category-index/index.json`의 최상위 `status`와 phase의 `status`를 `completed`로 변경한다.

## 의도 메모 (왜)

- 한 phase로 묶은 이유는 sitemap 제외와 noindex가 하나의 결정에서 나오기 때문이다.
  sitemap에서만 빼면 내부 링크가 많아 크롤러가 스스로 찾아가 색인할 수 있고,
  noindex만 걸면 sitemap이 색인하지 말라는 페이지를 계속 광고한다.
- 판정 기준을 `README` 길이로 삼은 이유는 실측상 페이지 본문 길이가 거기에 거의 비례했기 때문이다.
  하위 글이 106개인 `devops`도 본문은 717자였다. 글 목록은 제목만 나열해 기여가 작다.
- 직속 글 수를 두 번째 통로로 둔 이유는 `README`만으로 자르면 목록 자체의 탐색 가치를 놓치기 때문이다.
- `follow: true`를 유지한 이유는 얇은 카테고리에도 글 링크가 있어 크롤러의 글 도달 경로를 막을 이유가 없기 때문이다.
- 임계값 산출과 대안 기각은 ADR-036에 있다.
