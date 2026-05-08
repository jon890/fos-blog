# /privacy — 개인정보처리방침 페이지

## 목적

AdSense 승인 요건 충족 (ADR-014). 수집 정보(방문 통계 SHA-256 해시 / 댓글 닉네임 · bcrypt 비밀번호 / 테마 설정) + Google AdSense 쿠키 안내.

## 컴포넌트 구성

정적 JSX. `<article className="prose prose-gray dark:prose-invert">` 내 HTML 본문. 외부 컴포넌트 없음.

## 레이아웃

`prose` Tailwind Typography 클래스 적용, max-width 3xl. 별도 CSS 없음.

## revalidate

`export const revalidate = 86400` (ISR 24시간). 정책 변경 빈도 낮아 일별 재검증으로 충분.

## Notes

- `robots: { index: true }` — AdSense 심사 봇 접근 가능 필수 (ADR-014)
- 개정 이력은 페이지 본문 "6. 개정 이력" 섹션에 직접 추가 (`src/app/privacy/page.tsx`)
- Google Analytics 미사용 명시 (AdSense 쿠키는 Google이 관리)
