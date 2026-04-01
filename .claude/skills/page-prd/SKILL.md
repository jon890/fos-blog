---
name: page-prd
description: |
  특정 페이지의 코드를 분석해 AI Agent가 이해할 수 있는 간결한 PRD 문서를 docs/pages/ 에 생성하거나 갱신하는 스킬.
  다음 상황에서 반드시 이 스킬을 사용한다:
  - "page-prd", "페이지 문서화", "페이지 PRD 작성", "페이지 스펙 문서 만들어줘"
  - "이 페이지 분석해서 문서 만들어줘", "페이지 PRD 업데이트해줘", "docs 폴더에 페이지 문서 만들어줘"
  - 새 페이지를 구현하기 전 PRD를 먼저 작성하자고 할 때
  - 기존 페이지를 수정하기 전 현재 스펙을 문서화하자고 할 때
  - "page-impl 전에 PRD 먼저" 같은 흐름에서
  인수가 없으면 사용자에게 대상 페이지를 확인한다.
---

# page-prd — 페이지 PRD 자동 문서화

## 개요

페이지 코드를 읽고 AI Agent 친화적인 PRD 문서를 `docs/pages/<page-name>.md` 에 생성한다.
이 문서는 두 가지 목적으로 사용된다:

1. **유지보수 참조** — 기존 페이지 수정 시 컨텍스트로 활용
2. **신규 구현 입력** — `/page-impl` 스킬의 입력 문서로 사용 (PRD → 코드 플로우)

---

## 1단계: 대상 페이지 결정

인수가 있으면 그 페이지를, 없으면 사용자에게 확인한다.

```
/page-prd posts          → src/app/posts/[...slug]/page.tsx
/page-prd categories     → src/app/categories/page.tsx
/page-prd home           → src/app/page.tsx
/page-prd category       → src/app/category/[...path]/page.tsx
/page-prd search         → src/app/search/page.tsx
```

**파일 탐색 순서:**
1. `src/app/<arg>/page.tsx`
2. `src/app/<arg>/[...slug]/page.tsx`
3. `src/app/<arg>/[...path]/page.tsx`
4. `src/app/<arg>/[id]/page.tsx`
5. 없으면 Glob으로 탐색 후 사용자에게 선택 요청

> **API 라우트 제외**: `src/app/api/` 경로는 이 스킬의 대상이 아니다.
> API 스펙 문서가 필요하면 사용자에게 별도 스킬이나 직접 작업을 안내한다.

---

## 2단계: 코드 분석

**필요한 파일만 읽는다** — 과도한 탐색은 금지.

### 반드시 읽는 파일
- 페이지 파일 자체 (`page.tsx`)

### 필요 시 추가로 읽는 파일
- 페이지가 호출하는 repository 메서드 파일 (반환 타입 확인)
- 페이지에서 import하는 컴포넌트 파일 (props 인터페이스 확인, 1~2개로 제한)

### 파악 항목

| 항목 | 확인 방법 |
|------|-----------|
| 라우트 패턴 | 파일 경로에서 추론 |
| ISR/캐싱 | `export const revalidate` 값 |
| 데이터 소스 | `getRepositories()` 호출, fetch |
| 컴포넌트 | import 문 |
| 클라이언트 상태 | `"use client"` 여부, useState/useEffect |
| 인증/권한 | auth 관련 로직 |
| Metadata | `generateMetadata`, `export const metadata` |
| 정적 생성 | `generateStaticParams` 여부 |

---

## 3단계: PRD 문서 작성

`docs/pages/` 디렉토리가 없으면 생성한다.
아래 템플릿으로 `docs/pages/<page-name>.md` 를 작성한다.

**간결하게** — 각 섹션은 필요한 정보만. 해당 없는 섹션은 생략한다.

```markdown
# <Page Title> — Page PRD

**Route:** `<URL 패턴>`  
**File:** `<파일 경로>`  
**Updated:** <오늘 날짜 YYYY-MM-DD>

---

## Purpose

<이 페이지가 하는 일을 1~2문장으로.>

---

## Data

| Source | Method | Returns |
|--------|--------|---------|
| PostRepository | `getPost(slug)` | 글 본문 + 메타데이터 |

**ISR:** `revalidate = 60`  
**Static params:** `generateStaticParams()` 있음/없음

---

## Components

| Component | Role |
|-----------|------|
| `MarkdownRenderer` | 마크다운 본문 렌더링 |
| `TableOfContents` | 사이드바 목차 (lg 이상) |

---

## Interactions

- **<인터랙션>**: <결과>

(Server Component만 있으면 이 섹션 생략)

---

## Client State

| State | Component | Description |
|-------|-----------|-------------|
| `activeSlug` | `TableOfContents` | 현재 뷰포트 내 헤딩 |

(없으면 이 섹션 생략)

---

## SEO

- `generateMetadata()`: title, description, og, twitter, canonical
- JSON-LD: `ArticleJsonLd`, `BreadcrumbJsonLd`

---

## Related Files

- `src/app/posts/[...slug]/page.tsx`
- `src/components/MarkdownRenderer.tsx`
- `src/infra/db/repositories/PostRepository.ts`

---

## Constraints

- <이 페이지에만 적용되는 제약 또는 주의사항>
- 없으면 이 섹션 생략

---

## Known TODOs

- [ ] <있으면 기재, 없으면 이 섹션 생략>
```

---

## 4단계: 기존 문서 처리

`docs/pages/<page-name>.md` 가 이미 존재하면:
1. 기존 문서를 읽는다
2. 코드와 비교해 **변경된 항목만** 갱신한다
3. **Known TODOs** 섹션은 보존한다 — 기존 항목 삭제 금지
4. `Updated:` 날짜를 오늘로 갱신한다

---

## 5단계: 완료 보고

```
✅ docs/pages/<page-name>.md 생성/갱신 완료

- Route: <URL>
- 데이터 소스: <N>개
- 컴포넌트: <N>개
- ISR: revalidate = <값>
```

이후 사용자 의도에 따라 안내:
- 기존 페이지 수정이 목적 → "이 문서를 참조해 작업을 시작하겠습니다"
- 신규 페이지 구현이 목적 → "`/page-impl <page-name>` 으로 구현을 시작할 수 있습니다"

---

## 파일명 규칙

| 페이지 파일 | PRD 파일명 |
|------------|-----------|
| `src/app/page.tsx` | `docs/pages/home.md` |
| `src/app/categories/page.tsx` | `docs/pages/categories.md` |
| `src/app/category/[...path]/page.tsx` | `docs/pages/category-detail.md` |
| `src/app/posts/[...slug]/page.tsx` | `docs/pages/post-detail.md` |
| `src/app/search/page.tsx` | `docs/pages/search.md` |
