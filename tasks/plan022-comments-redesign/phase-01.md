# Phase 01 — shadcn install + sonner Toaster + Avatar 분리

**Model**: sonnet
**Goal**: 댓글 리디자인에 필요한 컴포넌트 인프라 구축. UI 재구성은 phase 2 에서.

## Context (자기완결)

`src/components/ui/button.tsx` 만 shadcn 으로 도입돼 있음. 이번 phase 에서 Form / Input / Textarea / AlertDialog 추가 + sonner toast 도입 + Avatar 컴포넌트 신규 + CommentItem 분리.

**플젝 컨벤션**:
- shadcn 컴포넌트는 `src/components/ui/` 에 자동 생성 (`pnpm dlx shadcn@latest add ...`)
- 새 client component 는 "use client" 선언
- Tailwind v4 + plan009 토큰 기준
- "전면 리디자인" 결정 (사용자 2026-05-06): threading 미포함, avatar nickname 이니셜 + 9색 hash, full shadcn

## 작업 항목

### 1. shadcn 컴포넌트 + sonner 설치

```bash
# cwd: <repo root>
pnpm dlx shadcn@latest add input textarea form alert-dialog
pnpm add sonner react-hook-form @hookform/resolvers zod
```

`pnpm dlx shadcn@latest add` 가 다음 파일 생성/덮어쓰기:
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/form.tsx` (react-hook-form 연동 wrapper)
- `src/components/ui/alert-dialog.tsx`
- 추가 dependency: `react-hook-form`, `@hookform/resolvers`, `zod`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-label`, `@radix-ui/react-slot` 등

shadcn init 이전 실행이라 `components.json` 가 이미 있으므로 prompt 없이 진행. Style/baseColor 는 기존 설정 사용.

**Token 충돌 검증**: shadcn 의 `input.tsx` / `textarea.tsx` 는 보통 `bg-background` / `text-foreground` 를 사용 — Tailwind v4 의 `@theme` 매핑이 plan009 의 `--color-bg-base|elevated` / `--color-fg-primary` 와 정합되는지 확인. 충돌 시 src/components/ui/ 파일 내부 className 만 plan009 토큰으로 교체. 핵심 검증: input border 색이 `--color-border-subtle` 와 일치하는지.

### 2. sonner Toaster 마운트

`src/app/layout.tsx` 에 `<Toaster />` 추가:

```tsx
import { Toaster } from "sonner";

// <body> 직속 children 끝에:
<Toaster
  position="bottom-center"
  theme="system"
  toastOptions={{
    classNames: {
      toast: "bg-[var(--color-bg-elevated)] text-[var(--color-fg-primary)] border border-[var(--color-border-subtle)]",
      success: "text-[var(--color-brand-400)]",
      error: "text-red-400",
    },
  }}
/>
```

`theme="system"` 으로 ThemeProvider(이미 있음) 의 dark/light 자동 감지.

### 3. `src/components/comments/Avatar.tsx` 신규

Nickname 이니셜 + plan009 카테고리 9색 hash 자동 선택:

```tsx
import { OG_CATEGORY_HEX } from "@/lib/og";

// plan021 의 OG_CATEGORY_HEX 를 단일 소스로 재사용 — 색상 변경 시 OG/Avatar 일관성 보장.
// (record → array 변환은 hash 모듈로 안정적으로 인덱스화하기 위함)
const AVATAR_PALETTE = Object.values(OG_CATEGORY_HEX);

function hashNickname(nickname: string): number {
  let h = 0;
  for (const ch of nickname) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h);
}

const SIZE_CLASS: Record<number, string> = {
  28: "h-7 w-7",
  36: "h-9 w-9",
};

export function Avatar({ nickname, size = 36 }: { nickname: string; size?: number }) {
  const initial = nickname.trim().charAt(0).toUpperCase() || "?";
  const color = AVATAR_PALETTE[hashNickname(nickname) % AVATAR_PALETTE.length];
  const sizeClass = SIZE_CLASS[size] ?? "h-9 w-9";
  return (
    <div
      role="img"
      aria-label={`${nickname} 아바타`}
      style={{ background: `${color}26`, color, borderColor: `${color}80` }}
      className={`${sizeClass} flex items-center justify-center rounded-full border font-semibold select-none`}
    >
      {initial}
    </div>
  );
}
```

`size` prop 으로 다양한 자리에서 재사용 (댓글 카드 36px, 답글 작성자 표시 28px). 동적 색상만 inline style 유지, 크기는 `SIZE_CLASS` 매핑으로 Tailwind class 사용.

**참고**: 팔레트는 plan021 `OG_CATEGORY_HEX` 의 `Object.values()` — 단일 소스. plan021 색상 갱신 시 자동 반영.

### 4. `src/components/comments/CommentItem.tsx` 분리

기존 `Comments.tsx` 에서 한 댓글 카드 렌더링 부분을 별도 컴포넌트로 추출. props:
- `comment: Comment` (드리즐 type)
- `onEdit: (comment: Comment) => void`
- `onDelete: (comment: Comment) => void`

이번 phase 에서는 **빈 골격만 작성** (return null 또는 단순 레이아웃) — 실제 UI 는 phase 2 에서. Phase 1 의 목적은 export 하는 함수 시그니처를 phase 2 가 import 할 수 있게 하는 것.

```tsx
// src/components/comments/CommentItem.tsx
"use client";

import type { Comment } from "@/infra/db/schema/comments";

export interface CommentItemProps {
  comment: Comment;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

export function CommentItem(_props: CommentItemProps) {
  // phase 2 에서 구현
  return null;
}
```

### 5. 검증

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
```

자동 verification:
```bash
test -f src/components/ui/input.tsx
test -f src/components/ui/textarea.tsx
test -f src/components/ui/form.tsx
test -f src/components/ui/alert-dialog.tsx
test -f src/components/comments/Avatar.tsx
test -f src/components/comments/CommentItem.tsx
grep -n "from \"sonner\"" src/app/layout.tsx
grep -n '"react-hook-form"' package.json
grep -n '"sonner"' package.json
grep -n '"zod"' package.json
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/ui/input.tsx` | 신규 (shadcn) |
| `src/components/ui/textarea.tsx` | 신규 (shadcn) |
| `src/components/ui/form.tsx` | 신규 (shadcn) |
| `src/components/ui/alert-dialog.tsx` | 신규 (shadcn) |
| `src/components/comments/Avatar.tsx` | 신규 |
| `src/components/comments/CommentItem.tsx` | 신규 (skeleton) |
| `src/app/layout.tsx` | 수정 (Toaster 마운트) |
| `package.json` | 수정 (sonner / react-hook-form / @hookform/resolvers / zod 추가) |

## Out of Scope

- 실제 댓글 UI 재구성 → phase 2
- API/Repo/Schema 변경 (threading 미포함 결정)
- post-detail.md 갱신 → phase 3

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| shadcn input/textarea 가 `bg-background` 등 Tailwind v4 매핑 변수 사용 | plan009 의 `@theme` 가 `--color-bg-base` 등을 export 하면 shadcn 변수와 매핑됨. 안 되면 `src/components/ui/input.tsx` 의 className 만 plan009 토큰으로 직접 교체 |
| sonner Toaster 의 dark/light 가 ThemeProvider 와 어긋남 | `theme="system"` 사용 — sonner 가 prefers-color-scheme 자동 감지. 우리 ThemeProvider 가 `.dark` 클래스 토글 방식이면 `theme="dark"/"light"` 동기화 wrapper 필요할 수 있음. 동작 확인 후 phase 2 에서 조정 |
| `shadcn add` 가 기존 button.tsx 덮어씀 | shadcn add 는 conflict 시 prompt — y/n 으로 우리 button 보존 (plan009 적용 상태). 또는 add 후 git diff 로 button.tsx 변경분 revert |
| react-hook-form + zod 설치 후 next/turbopack 캐시 오류 | `rm -rf .next` 후 `pnpm dev` 재시작 |
