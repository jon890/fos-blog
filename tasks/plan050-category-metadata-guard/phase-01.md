# Phase 01 — generateMetadata 가드 + React cache 도입

**Model**: sonnet
**Goal**: `src/app/category/[...path]/page.tsx` 의 `generateMetadata` 가 임의 path (실제 카테고리 데이터 없는) 에 대해서도 canonical 과 og:image 메타를 생성하는 문제 방어. 데이터 검증 후 빈 결과면 canonical 미생성 + robots noindex.

## Context (자기완결)

문제 흐름 (정찰 결과 2026-05-21):

1. `curl http://localhost:3000/category/분산_계산_알고리즘.md` → HTTP 200 + `x-nextjs-cache: HIT`
2. 응답 HTML 의 `<link rel="canonical">` 가 자기 자신 (`/category/분산_계산_알고리즘.md`) 가리킴
3. `<meta property="og:image">` 가 `/api/og/category/분산_계산_알고리즘.md` 가리킴
4. Google 이 한 번 발견 → og:image fetch 시도 → robots 차단 알람 (plan049 에서 robots 해제 후에도 잘못된 URL 인덱싱은 잔존)

코드 분석:

- `generateStaticParams` (line 63) 의 `computeFolderPaths` 는 root-level `.md` path 를 생성 안 함 → 정상 prerender 대상 아님
- `page()` 함수의 `notFound()` 가드 (line 93-95) 는 데이터 확인 후 호출. 정상 작동
- 그러나 `generateMetadata` (line 31~) 는 데이터 fetch 없이 path 만으로 metadata 생성 → 잘못된 path 도 canonical 가짐
- 누군가 한 번 잘못된 URL 로 접근하면 ISR 캐시에 prerender 결과 보존 → Google 발견 가능성

**해결 방향**:

- `generateMetadata` 에서도 `getFolderContents` 호출 → 빈 결과면 fallback metadata
- React `cache()` 로 wrap 해서 `generateMetadata` 와 `page()` 가 같은 DB 쿼리 공유 (중복 방지)
- fallback metadata: `canonical` 미생성, `openGraph` 미생성, `robots: { index: false, follow: false }`

## 작업 항목

### 1. React `cache` import + 헬퍼 함수 추출

`src/app/category/[...path]/page.tsx` 상단에 `cache` import 추가:

```ts
import { cache } from "react";
```

`getFolderContents` 호출을 cached 함수로 wrap. 파일 안에서:

```ts
const getCachedFolderContents = cache(async (folderPath: string) => {
  try {
    const { folder } = getRepositories();
    return await folder.getFolderContents(folderPath);
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Database not available",
    );
    return { folders: [], posts: [], readme: null } as Awaited<
      ReturnType<ReturnType<typeof getRepositories>["folder"]["getFolderContents"]>
    >;
  }
});
```

`generateMetadata` 와 `page()` 안의 기존 `await folder.getFolderContents(...)` 호출을 모두 `await getCachedFolderContents(folderPath)` 로 교체. React `cache()` 는 같은 인자로 호출 시 같은 request 안에서 결과 공유 — 중복 DB 쿼리 회피.

### 2. `generateMetadata` 가드 추가

기존 `generateMetadata` 안에서 path 처리 후 데이터 검증:

```ts
const pathSegments = resolvedParams.path.map(decodeURIComponent);
const folderPath = pathSegments.join("/");

const { folders, posts, readme } = await getCachedFolderContents(folderPath);

if (folders.length === 0 && posts.length === 0 && !readme) {
  return {
    title: "카테고리를 찾을 수 없습니다 | FOS Study",
    robots: { index: false, follow: false },
  };
}

// 기존 정상 metadata (canonical / openGraph 포함) 반환
return {
  title: `${currentFolder} | FOS Study`,
  // ... (기존 그대로)
};
```

### 3. `page()` 안의 `getFolderContents` 호출도 cached 함수로 교체

기존 line 84-89 의 try-catch 블록을 단일 호출로 교체:

```ts
const folderContents = await getCachedFolderContents(folderPath);
const { folders, posts, readme } = folderContents;

if (folders.length === 0 && posts.length === 0 && !readme) {
  notFound();
}
```

try-catch 는 cached 함수 안으로 이동 — 한 곳에서만 에러 처리. log.warn 호출도 cached 함수 안에서.

### 4. 자동 verification

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 코드 변경 확인
grep -n "cache\|getCachedFolderContents" src/app/category/\[...path\]/page.tsx
# 기대: import + 헬퍼 정의 + 사용 2건 (generateMetadata + page)
```

### 5. dev server 시각 확인

```bash
# cwd: /Users/nhn/personal/fos-blog
# 잘못된 path 응답 확인
curl -s "http://localhost:3000/category/%EB%B6%84%EC%82%B0_%EA%B3%84%EC%82%B0_%EC%95%8C%EA%B3%A0%EB%A6%AC%EC%A6%98.md" -m 5 | grep -oE '<(meta name="robots"|link rel="canonical")[^>]*>'
# 기대:
#   <meta name="robots" content="noindex,nofollow">
#   (canonical 라인 없어야 함)
```

기존 정상 카테고리도 회귀 없는지 확인:

```bash
# cwd: /Users/nhn/personal/fos-blog
curl -s "http://localhost:3000/category/devops" -m 5 | grep -oE '<link rel="canonical"[^>]*>'
# 기대: canonical 라인 1건 (정상 URL)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/category/[...path]/page.tsx` | 수정 (cache import + 헬퍼 + generateMetadata 가드 + page() 호출 통합) |

## Out of Scope

- `posts/[...slug]/page.tsx` 의 fallback metadata 에 noindex 추가 — 별 plan 후보 (현재 catch 분기는 `{ title: ... }` 만)
- ISR 캐시 무효화 — 다음 production deploy 사이클로 자연 해소 예상
- `dynamic = "force-static"` + `dynamicParams = false` 도입 — 너무 엄격 (사용자가 직접 입력한 valid folder URL 도 차단)
- root-level `.md` 파일 sync 정책 — DB 정찰 결과 0건이라 작업 대상 없음

## Risks

| 리스크 | 완화 |
|---|---|
| React `cache()` 가 generateMetadata 와 page() 사이에 공유되는지 (Next.js 15+ 동작) | Next.js 공식 권장 패턴. App Router 에서 같은 request 안에 cache() 공유 보장. 기존 fos-blog 의 다른 페이지 패턴 (예: `posts/[...slug]/page.tsx`) 도 같은 방식 적용 가능 |
| getFolderContents 가 DB 에러 던질 때 cached 함수가 빈 값 반환 vs 에러 전파 | 현재 page() 의 catch 가 빈 값 fallback 으로 처리. cached 함수도 동일하게 — 에러는 log.warn 후 빈 값. metadata 단에서도 자연스럽게 notFound metadata 출력 |
| 기존 prerender 캐시는 그대로 — 새 가드는 ISR 갱신 후 반영 | dev 환경에서 hot-reload 로 확인. production 은 다음 빌드 + 배포 사이클로 갱신. revalidate=60 이라 1분 후 새 응답 |
| `metadata.robots` 가 `{ index: false, follow: false }` — 너무 강한가? | follow:false 까지는 unnecessary. follow:true (링크 따라가기 허용) 가 일반적. 단 잘못된 path 라 따라갈 링크도 없음. follow:false 명시로 봇이 빠르게 떠나게 유도 — 부하 절감 |
