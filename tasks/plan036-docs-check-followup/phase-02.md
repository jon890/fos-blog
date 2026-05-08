# Phase 02 — docs/pages/ contact / privacy / tag 신규 작성

**Model**: sonnet
**Goal**: 기존 page.tsx 가 있으나 docs/pages/ 미동기인 3개 페이지 docs 신규 작성.

## Context (자기완결)

audit 결과 — 다음 page.tsx 가 실제 존재하나 docs/pages/{name}.md 부재:

- `src/app/contact/page.tsx` ↔ `docs/pages/contact.md` 부재
- `src/app/privacy/page.tsx` ↔ `docs/pages/privacy.md` 부재
- `src/app/tag/[name]/page.tsx` ↔ `docs/pages/tag.md` 부재

기존 docs/pages/*.md 7개 (about / categories / category-detail / home / post-detail / posts-latest / posts-popular) 의 작성 패턴 참조하여 동일 형식으로 작성.

## 작업 항목

### 1. 기존 page docs 패턴 파악

3개 신규 작성 전에 baseline 패턴 확인:

```bash
# cwd: <worktree root>
head -50 docs/pages/about.md
# 일반적인 page docs 구조: 페이지 목적 / 주요 컴포넌트 / 데이터 흐름 / Layout / Components / Data 표 + Notes
```

### 2. `docs/pages/contact.md` 신규 작성

`src/app/contact/page.tsx` 내용 grep 후 (`cat src/app/contact/page.tsx`) 다음 항목 채워서 작성:
- 페이지 목적 (예: AdSense 승인 요건 / 사용자 문의 채널)
- Layout 다이어그램
- Components 표 (사용 컴포넌트명 + 역할)
- Data 표 (있다면)
- Notes (의사결정 의도)

### 3. `docs/pages/privacy.md` 신규 작성

`src/app/privacy/page.tsx` 동일 패턴.

### 4. `docs/pages/tag.md` 신규 작성

`src/app/tag/[name]/page.tsx` 동일 패턴. `[name]` dynamic route 라 `decodeURIComponent(name)` 처리 + `getPostsByTag` 호출 등 명시.

### 5. 자동 verification

```bash
# cwd: <worktree root>
test -f docs/pages/contact.md && test -f docs/pages/privacy.md && test -f docs/pages/tag.md && echo "OK: 3 page docs created"

# page.tsx ↔ docs/pages/ 정합 (audit 검증)
ROUTES=$(find src/app -name "page.tsx" ! -path "*api*" ! -path "*\\(*" | sed 's|src/app/||;s|/page\.tsx||' | grep -vE '^\[|/\[' | sort)
DOCS=$(ls docs/pages/*.md 2>/dev/null | xargs -n1 basename | sed 's|\.md||' | sort)
echo "Routes: $ROUTES"
echo "Docs: $DOCS"
# Routes 의 about / categories / contact / home / posts/latest / posts/popular / privacy / tag 가 모두 Docs 에 있어야 함
# (home 은 Routes 의 "" 빈 문자열 또는 root 로 매핑 — 기존 docs/pages/home.md 가 root 페이지 docs 로 존재)
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `docs/pages/contact.md` | 신규 |
| `docs/pages/privacy.md` | 신규 |
| `docs/pages/tag.md` | 신규 |

## Out of Scope

- page.tsx 자체 변경 (코드 수정 0건)
- flow.md 라우트 추가 (phase-03 에서 처리)
- 기존 docs/pages/*.md 갱신 (해당 page.tsx 변경 없음)

## Risks

| 리스크 | 완화 |
|---|---|
| 3개 page.tsx 의 실제 구현이 단순 (예: privacy 가 정적 텍스트) → docs 로 적을 내용 부족 | "정적 컨텐츠" 페이지로 명시 + AdSense 정책 / 사용자 도달 경로 명시 |
| tag 페이지가 plan026 결과물과 일관성 (post 카드 nav) | `docs/pages/post-detail.md` 의 tag chip 부분 + ADR-023 참조 |
| 페이지 docs 의 컴포넌트 표가 코드 변경마다 부패 위험 | 의도적으로 "주요" 컴포넌트 1-2개만 명시. 전체 import 트리 복사 금지 (B 과대화) |
