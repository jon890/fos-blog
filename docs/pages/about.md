# /about — About 페이지

## 컴포넌트 구성

| 컴포넌트 | 데이터 소스 |
|---|---|
| `ProfileCard` | GitHub API (`/users/jon890`, `Authorization: Bearer`, `revalidate=3600`). 2-stage avatar — `ab-avatar-initial` 베이스 위에 `next/image` (`ab-avatar-img`) 가 `inset:0` 로 덮음 (ADR-022) |
| `SiteStats` | `StatsService.getAboutStats()` — DB 직접 조회 |
| `StackGrid` | 정적 상수 (`STACK`) |
| `LinksGrid` | 정적 상수 (`LINKS`), lucide-react 아이콘 |

## 레이아웃

container max-width 1180px, plan009 CSS 변수 (`--color-*`), numbered 섹션 헤더 (`01`–`04`). CSS: `src/app/about/about.css` (co-located) — `::before`/`::after` hairline, `@keyframes ab-pulse`, `oklch(... ${hue})` 동적 chip 색을 처리.

## 데이터

- `postCount` = `COUNT(*) WHERE isActive=true`
- `categoryCount` = `COUNT(DISTINCT posts.category) WHERE isActive=true`
- `lastSyncAt` = `MAX(posts.updatedAt) WHERE isActive=true`

## revalidate

`export const revalidate = 3600` (ISR 1시간). GitHub fetch 도 동일 `revalidate` 적용.
