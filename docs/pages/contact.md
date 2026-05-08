# /contact — 연락처 페이지

## 목적

AdSense 승인 요건 충족 (ADR-014) — privacy / about 과 함께 운영자 신뢰성 표시 필수 3페이지 중 하나. 이메일 + GitHub Issues 두 채널 안내.

## 컴포넌트 구성

정적 JSX (외부 컴포넌트 없음). 이메일 `<a href="mailto:...">` + GitHub Issues 외부 링크 두 카드로 구성.

## 레이아웃

container max-width 2xl (`max-w-2xl mx-auto`), 카드 2개 (`border rounded-lg`). 별도 CSS 없음 — Tailwind utility 만 사용.

## revalidate

미설정 (Next.js 기본 정적 렌더). 콘텐츠 변경이 없는 정적 페이지.

## Notes

- `robots: { index: true }` — AdSense 심사 봇이 접근 가능해야 함 (ADR-014)
- 이메일 주소 변경 시 이 파일이 아니라 `src/app/contact/page.tsx` 직접 수정
