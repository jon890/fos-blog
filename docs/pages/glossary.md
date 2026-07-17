# 용어집 — Page PRD

**Route:** `/glossary`

**File:** `src/app/glossary/page.tsx`

**Status:** 설계 확정, 구현 예정
**Related:** plan054, ADR-032

---

## Purpose

블로그에서 사용하는 전문 용어의 설명과 실제 언급 페이지를 한곳에서 탐색한다.
본문 툴팁의 상세 확인 경로이면서 Footer에서 직접 접근할 수 있는 보조 페이지다.

이 문서는 plan054 phase 05가 구현할 목표 페이지를 정의한다.
현재 route는 존재하지 않는다.

## Data

`GlossaryService.getGlossaryPageData()`가 용어 정의와 언급 페이지를 반환한다.
페이지는 서버 렌더링하고 60초 ISR을 사용한다.
DB 조회가 실패하면 구조화된 warning을 남기고 빈 상태로 렌더링한다.

## Layout

- 상단 hero
  - `GLOSSARY` eyebrow
  - 용어 수와 언급 페이지 수
  - 용어·전체 이름·별칭·요약 검색 입력
- 가나다·알파벳 색인
  - 현재 결과에 존재하는 초성 또는 영문 첫 글자만 표시
  - 선택 시 해당 그룹으로 이동
- 용어 목록
  - `id`를 DOM anchor로 사용
  - 대표 용어, `fullName`, 별칭, `summary`
  - Markdown `description`
  - 외부 참고 자료
  - 언급된 페이지 최근 5개와 나머지 펼침

## Interactions

- 검색은 이미 서버 렌더링된 항목을 client island에서 필터링한다.
- 검색 대상은 `term`, `fullName`, `aliases`, `summary`다.
- 언급 페이지는 `post`와 `category-readme` 표시를 구분한다.
- URL hash 진입 시 해당 용어 항목으로 이동하고 focus 가능한 heading을 제공한다.
- 결과가 없으면 검색어를 유지한 채 결과 없음 안내를 표시한다.

## Accessibility

- 검색 입력은 명시적인 label을 갖는다.
- 결과 수 변경은 `aria-live="polite"`로 알린다.
- 언급 페이지 펼침은 실제 `button`과 `aria-expanded`를 사용한다.
- 외부 참고 링크는 새 창 안내와 `rel="noopener noreferrer"`를 제공한다.

## Discovery

- 본문 툴팁의 "용어집에서 보기"
- `SiteFooter`의 `Glossary` 링크
- sitemap의 정적 `/glossary` 항목
- Header에는 추가하지 않는다.

## Empty States

- 용어 0개: 아직 등록된 용어가 없다는 안내를 표시한다.
- 검색 결과 0개: 검색어에 맞는 용어가 없다는 안내를 표시한다.

## Scope Exclusions

- `/glossary/[id]` 상세 라우트
- 웹 기반 용어 편집
- 용어 설명 안의 자동 용어 툴팁
