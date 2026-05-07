# Phase 01 — prose px → 토큰

**Model**: sonnet
**Goal**: `src/app/globals.css` 의 prose 확장 룰 (plan011) 의 하드코딩 px 값을 plan009 토큰 시스템으로 흡수. 시각 결과는 변경 없음.

## Context (자기완결)

`globals.css` 의 prose 영역 (line ~145 부터) 에 `28px`, `56px`, `16px`, `24px`, `20px`, `10px`, `12px` 등이 직접 박혀 있음. plan009 는 색/border 만 토큰화하고 spacing/typography scale 은 미정의.

## 작업 항목

### 1. `globals.css` `:root` 에 typography/spacing 토큰 추가

prose 전용 토큰 (semantic 별 grouping):

```css
:root {
  /* prose typography */
  --prose-h2-size: 28px;
  --prose-h2-margin-top: 56px;
  --prose-h2-margin-bottom: 16px;
  --prose-blockquote-padding: 4px 0 4px 20px;
  --prose-blockquote-margin: 24px 0;
  --prose-code-padding: 1px 6px;
  --prose-codeblock-padding: 16px 20px;
  --prose-codeblock-header-padding: 10px 14px;
  /* ... 실제 prose 영역 grep 결과의 모든 반복 px 값 */
}
```

**주의**: 1회 사용 + 일회성 값은 토큰화 X (issue #75 비-목표). 반복되거나 의미 단위인 값만.

executor 는 phase 시작 시 `grep -nE "[0-9]+px" src/app/globals.css | grep -v -E "//|\\*"` 로 prose 영역 전체 px 추출 → 의미 grouping 후 토큰화 결정.

### 2. prose 룰 px → var() 교체

```css
.prose h2 {
  font-size: var(--prose-h2-size);
  margin: var(--prose-h2-margin-top) 0 var(--prose-h2-margin-bottom);
  /* ... */
}
```

기존 line 188, 191, 206-208, 256, 262, 266, 290, 307, 323 등이 영향.

### 3. ArticleHero inline 시각 값 검토 (선택)

`ArticleHero.tsx` 의 `52px / 34px / 22ch / 880px` 등은 Tailwind arbitrary value 로 들어감. 이 phase 에서는 OOS — issue #75 의 "ArticleHero 도 가능한 범위" 는 대범위 영역이라 별도 plan 후보.

### 4. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# prose 영역의 직접 px 사용이 줄었는지
grep -cE "^\s*(font-size|margin|padding):.*[0-9]+px" src/app/globals.css
# → 신규 토큰 추가 후 prose 영역의 inline px 는 0 또는 거의 0 으로 축소

# 신규 토큰 추가됨
grep -nE "--prose-(h2|blockquote|code)" src/app/globals.css | wc -l  # 5+ 줄
```

수동 smoke (사용자 안내):
- `pnpm dev` → 글 상세 페이지 진입 → H2 / blockquote / inline code / 코드 블록 시각 비교 (변경 전후 동일)
- 다크/라이트 양쪽 확인

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/app/globals.css` | 수정 (토큰 추가 + 룰 var() 참조) |

## Out of Scope

- ArticleHero inline 값 토큰화
- 모든 globals.css px 토큰화 — 일회성 사용처는 inline 유지 (issue #75 비-목표)
- 새 spacing scale 도입 (Tailwind v4 default 그대로)
- mockup 톤 변경

## Risks

| 리스크 | 완화 |
|---|---|
| 토큰화 후 시각 회귀 | phase 2 의 수동 smoke 로 글 상세 / 다크 / 라이트 / 모바일 모두 확인. 회귀 발견 시 immediate revert |
| 토큰 이름이 향후 의미 변화에 발목 (예: `--prose-h2-size` 가 다른 곳 영향) | semantic naming + scope 제한 (`--prose-*` prefix) — 다른 영역 영향 없음 |
| 1회성 px 까지 토큰화하면 토큰 인플레 | 명시적 비-목표. 반복/의미 단위만 토큰화 |
