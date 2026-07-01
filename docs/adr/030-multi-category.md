## ADR-030. 다중 카테고리 — 경로 primary + frontmatter 추가, 카테고리 페이지 cross-post 노출 (plan051)

- **결정**: 한 글이 여러 카테고리에 속할 수 있게 한다.
  - 경로 첫 폴더를 primary `category`(단일)로 유지하고, frontmatter `categories: [..]` 로 추가 카테고리를 더한다.
  - 합집합 `[경로 category, ...frontmatter categories]`(중복 제거)를 `posts.categories` json 배열에 저장한다.
  - `/category/{path}` 페이지에 폴더 직속 글 + "cross-post 글"(`categories` 에 현재 `path` 를 포함하지만 경로상 해당 폴더 밖에 있는 글)을 합쳐 노출한다.
    `path` 는 `AI` 같은 최상위 폴더뿐 아니라 `AI/RAG` 같은 하위 폴더 경로도 허용한다.
    cross-post 조회는 `JSON_CONTAINS(categories, ?)` 에 현재 폴더 경로 prefix 제외를 더해 한다.
    depth 1 에선 prefix 제외가 기존 primary 카테고리 제외와 같은 의미다.
  - 글 배지(카드·상세·검색)는 단일 chip 대신 `categories` 배열 전체를 표시한다. 첫 요소(primary)는 기존 위치를 유지한다.
- **맥락**: 카테고리 탐색이 100% 경로 기반이다.
  - `/category/[...path]` 는 `post.path.startsWith(folderPath + "/")` 폴더 브라우저이고, `category` 는 경로 첫 폴더(`parsePath`)다.
  - 한 글은 한 폴더 = 단일 카테고리뿐이라 "AI 폴더 글을 DevOps 에도 노출" 같은 다중 소속을 경로로는 풀 수 없다.
  - 폴더 계층(경로)과 카테고리 소속(다중)은 서로 다른 축이라, 폴더 브라우저를 교체하지 않고 depth-1 페이지에 cross-post 만 더해 두 축을 모두 보존한다.
- **대안 기각**:
  - **폴더 브라우저 자체를 categories 조회로 교체** 기각 — 하위 폴더 카드·deep path 탐색(경로 축)이 깨진다. depth-1 에 cross-post 를 더하는 방식이 폴더 탐색을 보존하면서 다중 소속을 노출한다.
  - **죽은 `getPostsByCategory` 를 다중화** 기각 — 프로덕션 호출자가 없어 화면에 무동작이다. 실제 노출은 카테고리 페이지(`getFolderContents` + cross-post 조회)에 배선한다.
  - **frontmatter 가 전체 카테고리 목록(경로 무시)** 기각 — 기존 글 전부에 frontmatter 를 추가해야 한다. primary 유지 시 frontmatter 없는 글이 `[category]` 1개로 그대로 동작해 마이그레이션이 불필요하다.
  - **post_categories 관계 테이블** 기각 — 카테고리가 9개 규모라 정규화 이득이 작고 sync·조회·마이그레이션이 늘어난다. 이미 `tags` 가 json 배열이라 패턴이 일관적이다.
- **범위 제외 (별도 후속 plan)**:
  - 연관 글(`getRelatedPosts`)의 다중 카테고리화 — 단일 `category` + 태그 점수 방식을 유지한다.
  - `/categories` landing 글 수(`getCategoryStats`)의 다중 집계 — primary 기준을 유지한다(cross-post 는 카테고리 페이지엔 노출되나 landing 카운트는 primary home 만 센다).
- **트레이드오프**:
  - json 배열은 `JSON_CONTAINS` 풀스캔이라 인덱스 활용이 어렵다. 글 수가 적어 허용하고, 커지면 multi-value index 또는 관계 테이블 이전을 별도 plan 으로 검토한다.
  - sync 저장은 full·incremental 두 경로가 있다. 두 경로 모두 frontmatter 를 파싱해 `categories` 를 저장해야 평상시(증분) 운영에서 누락이 없다. 공통 헬퍼로 두 경로의 정합을 보장한다.
  - frontmatter 카테고리명은 폴더 경로와 대소문자가 일치해야 매칭된다(`JSON_CONTAINS` 대소문자 민감).
    불일치 시 글 저자가 매칭 누락을 겪을 수 있으므로 sync 단계에서 알려진 카테고리 prefix로 해석되지 않는 값을 `warn` 로그로 남긴다.
    작성 가이드(폴더명 그대로 쓸 것)는 fos-study `CLAUDE.md`("카테고리와 Frontmatter" 절)에 명시했다.
  - 색상과 아이콘은 slash path 전체를 canonical 9종으로 늘리지 않고 첫 세그먼트 기준으로 fallback한다.
    예: `AI/RAG`는 `AI`와 같은 색상·아이콘을 사용한다.
