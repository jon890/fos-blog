<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# app/components

## Purpose

App Router 전용 Server Component 래퍼 디렉토리. DB 데이터를 서버에서 fetch하여 `components/`의 Client Component에 props로 전달하는 역할을 담당한다. "use client"가 필요한 UI 컴포넌트는 `/components`에, 서버 데이터 페칭 로직은 이 디렉토리에 위치한다.

## Key Files

| File | Description |
|------|-------------|
| `FolderSidebarWrapper.tsx` | DB에서 폴더 경로와 포스트 목록을 fetch해 `FolderSidebar`에 전달하는 Server Component |

## For AI Agents

### Working In This Directory

- 이 디렉토리의 컴포넌트는 **Server Component**여야 한다 — `"use client"` 추가 금지
- DB 접근은 `@/services/`를 통해서만 수행한다 — 직접 `@/infra/db/` import 금지
- UI 렌더링 로직은 포함하지 않는다 — 데이터 fetch 후 `/components/`의 컴포넌트에 위임

### Common Patterns

```tsx
// Server Component wrapper 패턴
export async function XxxWrapper() {
  const data = await postService.getSomething();
  return <XxxClientComponent data={data} />;
}
```

## Dependencies

### Internal
- `@/services/` — 비즈니스 로직 (PostService 등)
- `@/infra/db/constants` — categoryIcons 등 공유 상수
- `@/components/` — 실제 렌더링을 담당하는 Client Component

<!-- MANUAL: -->
