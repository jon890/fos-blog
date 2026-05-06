# Phase 02 — Comments.tsx 리팩토링

**Model**: sonnet
**Goal**: 댓글 영역 본체 재구축 — react-hook-form + zod + plan009 토큰 + 아바타 적용. 기능 유지(작성/수정/삭제 + password 인증), UI/UX 만 전면 교체.

## Context (자기완결)

phase 1 에서 shadcn (Form / Input / Textarea / AlertDialog) + sonner + react-hook-form + zod 설치 완료. `src/components/comments/Avatar.tsx`, `CommentItem.tsx` (skeleton) 생성 완료.

이번 phase 는:
1. `Comments.tsx` 를 컨테이너로 줄이고
2. `CommentItem.tsx` 를 실제 카드로 채우고
3. `CommentForm.tsx` 신규 — 작성/수정 통합 form (react-hook-form + zod 검증)
4. `DeleteConfirmDialog.tsx` 신규 — AlertDialog 래퍼 + password 입력
5. 모든 색상 plan009 토큰 + Avatar 통합

기존 API (`POST /api/comments`, `PATCH /api/comments/[id]`, `DELETE /api/comments/[id]`) 는 변경 없음. 호출 contract 도 동일.

## 작업 항목

### 1. `src/components/comments/CommentForm.tsx` 신규 (작성/수정 통합)

react-hook-form + zod schema:

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  nickname: z.string().min(1, "닉네임을 입력하세요").max(100),
  password: z.string().min(4, "비밀번호는 4자 이상").max(255),
  content: z.string().min(1, "내용을 입력하세요").max(5000),
});
type FormValues = z.infer<typeof schema>;

export interface CommentFormProps {
  mode: "create" | "edit";
  initialContent?: string;
  initialNickname?: string;  // edit 일 때 read-only 표시 + form 에는 빈 값 (서버 검증은 password 만)
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel?: () => void;
}
```

- `mode === "edit"` 일 때 nickname 필드 read-only 또는 hidden, password 만 노출 (기존 동작 유지)
- submit 중 button disabled + 작은 spinner (lucide `Loader2 animate-spin`)
- error 시 `toast.error(message)` 호출 (sonner)

### 2. `src/components/comments/CommentItem.tsx` 본체 채우기

Phase 1 skeleton 을 채운다. 시각 구조:

```
┌────────────────────────────────────────┐
│ [Avatar] nickname    ·  2시간 전    [⋯] │
│                                          │
│           댓글 본문 텍스트                │
│           여러 줄 가능                    │
│                                          │
└────────────────────────────────────────┘
```

- 컨테이너: `bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[12px] p-5`
- 메타: `Avatar` + nickname (`text-[var(--color-fg-primary)] font-medium`) + 시간 (`text-[var(--color-fg-muted)] text-sm`)
- 본문: `text-[var(--color-fg-secondary)] leading-relaxed whitespace-pre-wrap`
- 우상단 액션: edit / delete 아이콘 버튼 (`Button variant="ghost" size="icon"`)
- 시간 포맷: `formatDistanceToNow` 류 — 외부 라이브러리 추가 금지. `src/lib/format-time.ts` 신규 또는 기존 util 재사용. 간단 helper:
  ```ts
  export function formatRelativeTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "방금 전";
    if (min < 60) return `${min}분 전`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}시간 전`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}일 전`;
    return date.toLocaleDateString("ko-KR");
  }
  ```
  `src/lib/` 에 기존 시간 helper 가 있는지 확인 후 중복 회피.

### 3. `src/components/comments/DeleteConfirmDialog.tsx` 신규

shadcn AlertDialog 래퍼:

```tsx
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
}
```

- AlertDialog open/close 제어
- 본문: "댓글을 삭제하시겠습니까?" + password Input
- Confirm 버튼: `variant="destructive"` 또는 `bg-red-600` 류 — plan009 에 `--color-error` 가 있으면 그걸 사용 (`bg-[var(--color-error)]`)
- Cancel: `variant="outline"`

### 4. `src/components/Comments.tsx` 컨테이너로 슬림화

기존 354줄 → 약 100줄 컨테이너로:
- `useState` 로 `comments`, `isLoading`, `editingId`, `deletingId` 만 관리
- `useEffect` 로 댓글 fetch
- 자식: `<CommentForm mode="create" onSubmit={handleCreate} />`, `<CommentItem ... />` 매핑, `<DeleteConfirmDialog .../>`, edit 시 `<CommentForm mode="edit" .../>` 인라인 표시
- 모든 색상은 plan009 토큰. 섹션 헤더:
  ```tsx
  <section className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
    <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-fg-primary)] mb-6">
      <MessageCircle className="w-5 h-5 text-[var(--color-brand-400)]" />
      댓글 ({comments.length})
    </h2>
    {/* form + list */}
  </section>
  ```
- 빈 상태: `comments.length === 0 && !isLoading` 시 `text-[var(--color-fg-muted)] text-center py-12` "첫 댓글을 남겨주세요"
- 로딩: skeleton row 3개 (`bg-[var(--color-bg-subtle)] animate-pulse h-24 rounded-[12px]`)

### 5. `console.error("Failed to ...")` → `toast.error()` 대체

기존 alert / console.error 호출은 sonner toast 로 교체:
- 작성 성공: `toast.success("댓글이 등록되었습니다")`
- 작성 실패: `toast.error("댓글 등록 실패")` — 서버 에러 메시지 우선
- 수정/삭제 동일 패턴

### 6. 자동 verification

```bash
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 잔존 하드코딩 색 0줄 (Comments.tsx + comments/ 하위 전체)
! grep -nE "bg-white|bg-gray-|bg-blue-|bg-red-|text-gray-|text-white|border-gray-|focus:ring-blue" src/components/Comments.tsx src/components/comments/

# 신규 파일
test -f src/components/comments/CommentForm.tsx
test -f src/components/comments/DeleteConfirmDialog.tsx

# react-hook-form 사용
grep -n "useForm" src/components/comments/CommentForm.tsx

# Avatar 사용
grep -n "Avatar" src/components/comments/CommentItem.tsx
```

## Critical Files

| 파일 | 상태 |
|---|---|
| `src/components/Comments.tsx` | 대폭 수정 (컨테이너 슬림화) |
| `src/components/comments/CommentForm.tsx` | 신규 |
| `src/components/comments/CommentItem.tsx` | 본체 채우기 (phase 1 skeleton) |
| `src/components/comments/DeleteConfirmDialog.tsx` | 신규 |
| `src/lib/format-time.ts` | 신규 (또는 기존 helper 재사용) |

## Out of Scope

- post-detail.md 문서 갱신 → phase 3
- 댓글 schema 변경 (threading) — 결정상 미포함
- 댓글 좋아요 / 신고 등 기능 추가
- 모바일 키보드 자동 띄움 최적화 (현재 동작 유지)

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| react-hook-form + zod 의 Korean error message 가 한국어로 안 나올 위험 | zod schema 의 `.min()/.max()` 두 번째 인자에 한글 메시지 직접 명시 (예제 코드 참조) |
| AlertDialog 가 모바일에서 viewport 잘림 | shadcn AlertDialog 는 max-w + overflow auto 기본 적용 — 자체 padding 추가 시 검증 |
| `formatRelativeTime` 가 SSR/CSR 시간 차이로 hydration mismatch | CommentItem 에 "use client" 명시 — server render 결과는 placeholder, client 에서 useEffect 로 시간 계산하거나, 서버 시간 기준 createdAt ISO string 만 받아 client 에서 변환 |
| sonner 의 toast 가 dark mode 에서 색 어긋남 | phase 1 의 Toaster `classNames` 토큰 매핑이 정상 작동하는지 시각 확인. 안 되면 `theme="dark"` 또는 ThemeProvider 동기화 hook 도입 |
| Comments.tsx 슬림화 시 기존 password 인증 로직 누락 | 작성 시 password 그대로 전송, edit/delete 는 DeleteConfirmDialog / CommentForm(mode=edit) 에서 password Input 으로 별도 받음 — 기존 API contract 변경 없음 |
