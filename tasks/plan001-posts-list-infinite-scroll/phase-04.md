# Phase 04 — 공용 클라이언트 컴포넌트 4개

## 컨텍스트 (자기완결 프롬프트)

무한 스크롤 페이지 + 홈 섹션에서 재사용할 클라이언트 컴포넌트를 구현한다. 신규 라이브러리 미도입 (ADR-006 — IntersectionObserver 직접 구현). 모든 컴포넌트 `"use client"` 최상단 명시.

## 먼저 읽을 문서

- `docs/code-architecture.md` — §4 `PostsInfiniteList` 컴포넌트 설계
- `docs/pages/posts-latest.md`, `docs/pages/posts-popular.md` — Layout/Interactions
- `docs/adr.md` — ADR-006 (IO 직접 구현)
- `src/components/AGENTS.md`

## 기존 코드 참조

- `src/components/PostCard.tsx` — 재사용할 기존 카드 컴포넌트
- `src/components/ThemeToggle.tsx` / `src/components/SearchDialog.tsx` — `"use client"` + useState/useEffect 패턴
- `src/components/TableOfContents.tsx` — IntersectionObserver 기존 사용 사례 (scroll-spy)
- Tailwind: `src/app/globals.css` — `@source` 규칙 (신규 디렉터리 추가 시 반영 필요 여부 검토)

## 작업 목록 (총 4개)

### 1. `PostCardSkeleton.tsx`

파일: `src/components/PostCardSkeleton.tsx`

- `"use client"` 불필요 (순수 정적 JSX) — **서버 컴포넌트로 유지**
- 디자인: `PostCard`와 동일한 외곽 크기. 내부는 Tailwind `animate-pulse` + 회색 placeholder 블록 3줄 (제목/메타/설명)
- props 없음
- 다크모드 클래스 포함 (`dark:bg-gray-800` 등)

### 2. `BackToTopButton.tsx`

파일: `src/components/BackToTopButton.tsx`

`"use client"`.

- props: `{ variant: "floating" | "inline" }`
- `variant="floating"`: `fixed bottom-6 right-6 z-40`. 스크롤 > 300px 일 때만 노출 — `useEffect`에서 `window.addEventListener("scroll", ...)` 등록 + cleanup 필수
- `variant="inline"`: 정적 버튼. 스크롤 조건 없음. 중앙 정렬 가능 클래스
- 클릭 시 `window.scrollTo({ top: 0, behavior: "smooth" })`
- 아이콘: `lucide-react`의 `ArrowUp`
- 접근성: `<button aria-label="맨 위로 이동">`, `focus-visible:ring-2`

### 3. `SectionCTAButton.tsx`

파일: `src/components/SectionCTAButton.tsx`

- 서버 컴포넌트 (`"use client"` 불필요) — 단순 `<Link>` 래퍼
- props: `{ href: string; label: string; icon?: React.ReactNode }`
- 디자인: 섹션 하단 중앙 정렬 + 강조 버튼 스타일. Tailwind `inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 ...`
- `<Link href={href}>{icon} {label} →</Link>` 형태

### 4. `PostsInfiniteList.tsx` (핵심)

파일: `src/components/PostsInfiniteList.tsx`

`"use client"` 최상단.

**Props**:
```ts
type PostItem = PostData & { visitCount: number };

type Props =
  | {
      mode: "latest";
      initialItems: PostItem[];
      initialNextCursor: string | null;
    }
  | {
      mode: "popular";
      initialItems: PostItem[];
      initialOffset: number;   // 다음 요청에 보낼 offset (= initialItems.length)
      initialHasMore: boolean;
    };
```

**상태**:
```ts
const [items, setItems] = useState<PostItem[]>(initialItems);
const [status, setStatus] = useState<"idle"|"loading"|"error"|"done">(
  initialDoneCondition ? "done" : "idle"
);
const [nextCursor, setNextCursor] = useState<string|null>(...);
const [nextOffset, setNextOffset] = useState<number>(...);
const sentinelRef = useRef<HTMLDivElement|null>(null);
const observerRef = useRef<IntersectionObserver|null>(null);
```

**loadMore()** 함수:
- `if (status === "loading" || status === "done") return`
- `setStatus("loading")`
- `mode === "latest"` → `fetch('/api/posts/latest?limit=10&cursor=<nextCursor or "">')`
- `mode === "popular"` → `fetch('/api/posts/popular?limit=10&offset=<nextOffset>')`
- 응답 `!ok` → `setStatus("error")` (인라인 "재시도" 버튼 노출)
- 성공: `setItems(prev => [...prev, ...res.items])`, next 상태 갱신, 끝이면 `setStatus("done")` else `setStatus("idle")`

**IntersectionObserver useEffect**:
- mount 시 `new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: "200px" })` 생성
- sentinel ref observe
- cleanup: disconnect

**수동 버튼**:
- `<button onClick={loadMore}>더 보기</button>` 항상 노출 (ADR 접근성). 단 `status === "done"` 이면 숨김

**에러 상태**:
- `status === "error"`: 인라인 "재시도" 버튼 — `onClick={loadMore}` (같은 cursor/offset)

**끝 도달**:
- `status === "done"`: `<p role="status">더 이상 글이 없습니다.</p>` + `<BackToTopButton variant="inline" />`

**접근성**:
- 리스트 `role="feed"` 또는 기본 `<div>`. 로딩 상태 영역 `aria-live="polite"`
- 수동 버튼 focus ring

**렌더 구조**:
```
<div>
  {items.map(PostCard)}
  <div ref={sentinelRef} aria-hidden="true" />
  <div aria-live="polite">
    {status === "loading" && [Skeleton × 3]}
    {status === "error" && <button onClick={loadMore}>재시도</button>}
    {status !== "done" && <button onClick={loadMore}>더 보기</button>}
    {status === "done" && (
      <><p role="status">더 이상 글이 없습니다.</p><BackToTopButton variant="inline"/></>
    )}
  </div>
</div>
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 파일 존재
test -f src/components/PostCardSkeleton.tsx
test -f src/components/BackToTopButton.tsx
test -f src/components/SectionCTAButton.tsx
test -f src/components/PostsInfiniteList.tsx

# 2) "use client" 지시문 (클라이언트 컴포넌트만)
grep -l '"use client"' src/components/BackToTopButton.tsx
grep -l '"use client"' src/components/PostsInfiniteList.tsx
# Skeleton/SectionCTA는 서버 컴포넌트 — "use client" 없어야 함
! grep -l '"use client"' src/components/PostCardSkeleton.tsx
! grep -l '"use client"' src/components/SectionCTAButton.tsx

# 3) IntersectionObserver 직접 사용 (ADR-006 준수 — 외부 라이브러리 없음)
grep -n "new IntersectionObserver" src/components/PostsInfiniteList.tsx
! grep -nE "from ['\"]react-intersection-observer" src/components/

# 4) Cleanup 패턴 (메모리 누수 방지)
grep -nE "(disconnect|removeEventListener)" src/components/PostsInfiniteList.tsx
grep -nE "removeEventListener" src/components/BackToTopButton.tsx

# 5) 접근성 마커
grep -n "aria-live" src/components/PostsInfiniteList.tsx
grep -n "aria-label" src/components/BackToTopButton.tsx
grep -nE 'role="status"' src/components/PostsInfiniteList.tsx

# 6) 금지사항 (code-reviewer가 반복 지적)
! grep -nE "console\.(log|info|warn)" src/components/PostCardSkeleton.tsx src/components/BackToTopButton.tsx src/components/SectionCTAButton.tsx src/components/PostsInfiniteList.tsx
! grep -nE "as any" src/components/PostsInfiniteList.tsx

# 7) 타입 체크 + 린트
pnpm type-check
pnpm lint
```

## PHASE_BLOCKED 조건

- Next.js 16에서 `"use client"` 트리 전파 에러 → **PHASE_BLOCKED: RSC 경계 재설계 필요**
- Tailwind `@source` 규칙 누락으로 클래스가 빌드에서 제거됨 → **PHASE_BLOCKED: `src/app/globals.css` 확인 + 필요 시 `@source` 추가**

## 커밋 제외

이 phase는 커밋하지 않는다.
