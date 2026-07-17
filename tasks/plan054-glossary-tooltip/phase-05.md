# Phase 05 — 공개 용어집 페이지와 발견 경로

**Model**: sonnet
**Status**: pending

---

## 목표

단일 `/glossary` 페이지에서 정의와 언급 페이지를 탐색하고 Footer·sitemap·본문 툴팁에서 접근할 수 있게 한다.

**범위 외**: `/glossary/[id]`, Header navigation, 웹 편집 기능.

## 작업 항목 (5)

### 1. server page와 metadata

`src/app/glossary/page.tsx`를 추가하고 `revalidate = 60`을 사용한다.
`GlossaryService.getGlossaryPageData()` 결과를 서버에서 읽는다.

DB 실패 시 구조화 warning과 빈 목록으로 폴백한다.
canonical, description, Open Graph metadata를 설정한다.
각 용어 heading은 `id` anchor와 programmatic focus가 가능한 구조를 가진다.

### 2. 검색과 가나다·알파벳 색인

`src/components/glossary/GlossaryIndex.tsx` client island를 추가한다.

server page가 각 용어의 `MarkdownRenderer` 결과를 React node로 먼저 만들고, `GlossaryIndex`에는 직렬화 가능한 검색 metadata와 pre-rendered node를 함께 전달한다.
client component가 server-only `MarkdownRenderer`를 import하거나 Markdown을 HTML string으로 변환하지 않는다.

- 검색 대상은 `term`, `fullName`, `aliases`, `summary`다.
- case-insensitive substring 검색을 적용한다.
- 결과 수를 `aria-live="polite"`로 알린다.
- 현재 결과에 존재하는 가나다 초성 또는 영문 첫 글자 색인을 제공한다.
- 용어 0개와 검색 결과 0개 상태를 분리한다.

### 3. 용어 항목과 언급 페이지

각 항목에 대표 용어, 전체 이름, 별칭, summary, Markdown description, references를 표시한다.
description의 `MarkdownRenderer`는 `enableGlossary={false}`로 호출한다.

언급 페이지는 최근 수정 순 5개를 먼저 보이고 나머지는 button으로 펼친다.
`post`와 `category-readme` badge를 구분하고 canonical URL segment를 각각 encode한다.

### 4. 발견 경로

`SiteFooter`의 `SITE_LINKS`에 `/glossary`를 추가한다.
Header navigation은 변경하지 않는다.
`src/app/sitemap.ts`의 static pages에 `/glossary`를 weekly, priority 0.5로 추가한다.

### 5. 페이지 회귀 테스트

jsdom component 테스트로 검색, 결과 없음, mention 펼침, description의 glossary 비활성화 계약을 검증한다.
server page 데이터 실패 폴백과 metadata는 source-level 회귀 또는 기존 page test 패턴으로 고정한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/app/glossary/page.tsx` | 신규 server page |
| `src/components/glossary/GlossaryIndex.tsx` | 검색·색인 client island |
| `src/components/glossary/GlossaryIndex.test.tsx` | UI 회귀 테스트 |
| `src/components/SiteFooter.tsx` | Glossary 링크 |
| `src/app/sitemap.ts` | 정적 URL 추가 |
| `src/app/globals.css` | glossary prose·tooltip 스타일 |

## 검증

```bash
# cwd: /Users/nhn/personal/fos-blog
pnpm test --run src/components/glossary/GlossaryIndex.test.tsx
pnpm type-check
rg -n 'href: "/glossary"|/glossary' src/components/SiteFooter.tsx src/app/sitemap.ts
! rg -n 'href: "/glossary"' src/components/Header.tsx
```

기대값:

- 테스트와 type-check exit code가 0이다.
- Footer와 sitemap `rg`는 각각 `/glossary`를 출력한다.
- Header `rg` 출력은 0줄이다.

## 의도 메모 (왜)

- 접근 빈도가 낮아 main Header 밀도를 늘리지 않고 contextual tooltip과 Footer를 진입점으로 사용한다.
- 별도 detail route 대신 `#id` anchor를 유지해 MVP 라우트 수를 제한한다.
- glossary 설명에서 tooltip을 끄는 규칙이 자기 참조와 재귀 변환을 막는다.
