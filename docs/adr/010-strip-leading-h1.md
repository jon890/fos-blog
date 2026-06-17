## ADR-010. Markdown 본문 선두 H1 제거 (`stripLeadingH1`)

**Context**: 글 상세에서 페이지 `<h1>{title}</h1>` + Markdown 본문 첫 `# Title` 둘 다 렌더 → **H1 2개**. `extractTitle` 은 추출만 하고 원본 미수정. FolderPage README 도 동일.

**Decision**: `src/lib/markdown.ts` 에 `stripLeadingH1(content)` 추가 — 선두 `^#\s+.+$` 1개 + 뒤이은 빈 라인 제거. 본문 중간 h1 은 유지 (섹션 마커). 글 상세 + FolderPage README 렌더 직전 적용.

**Why**: Google SEO 권고(페이지당 단일 H1) + Markdown 원본(`jon890/fos-study`) 의 `# Title` 관행 보존 — 렌더 단계만 정리. h1→h2 강등(중간 h1 도 강등)/원본 수정(200+ 글 + sync 마다 재수정)/remark plugin(과함) 기각. TOC 는 stripped content 로 생성 → H1 중복 없음.
