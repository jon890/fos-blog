## ADR-021. 댓글 디자인 라이브러리 + 보안 정책 (plan022)

**Context**: 댓글 영역 354줄 자체 구현 (`Comments.tsx`) 을 plan022 에서 shadcn + react-hook-form + zod + sonner 로 전면 리디자인. UI 라이브러리 선택과 함께 client 번들 격리 / XSS 가드 / 사용자 노출 메시지 정책 동시 결정.

**Decision**:

1. **Form**: `react-hook-form` + `@hookform/resolvers` + `zod`. shadcn `Form` (Controller wrapper) 사용. 모드 별 schema 분리 (`createSchema` / `editSchema = createSchema.pick({password, content})`) + props discriminated union.
2. **Toast**: `sonner` 2.x (~6KB). `<Toaster />` 는 `<ThemeProvider>` 바깥에 mount (shadcn 권장).
3. **Avatar 팔레트**: `og-palette.ts` 신규 — `OG_CATEGORY_HEX` (7색) + `getCategoryHex` 의 단일 소스. `og.ts` 는 re-export 만. **이유**: `og.ts` 가 `node:fs` import 하므로 client component (Avatar.tsx) 에서 직접 import 시 Turbopack 이 fs 를 클라이언트 번들에 포함하려다 실패. palette 데이터를 pure module 로 떼면서 단일 소스 유지.
4. **Comment 타입**: `src/components/comments/types.ts` 신규 (`CommentData`). client component 가 `@/infra/db/schema/comments` (Drizzle) 직접 import 시 같은 번들 오염 발생 → 분리.
5. **XSS 가드 (단방향 저장 시점 escape)**: `src/lib/escape-html.ts` 의 `escapeHtml` (5문자: `& < > " '`) 을 `CommentRepository.createComment` / `updateComment` 의 `content` 인자에 적용. **read 시 unescape 없음** — React JSX text node 가 자동 escape 하므로 이중 escape 회피 (1회만 적용). `dangerouslySetInnerHTML` 사용 금지.
6. **에러 메시지 정책 (`USER_FRIENDLY_ERRORS` 화이트리스트)**: API 에러 응답에 `code` 필드 (`PASSWORD_MISMATCH` / `NOT_FOUND` 등) 포함, 클라이언트는 `USER_FRIENDLY_ERRORS[code] ?? "요청을 처리할 수 없습니다"` 로 매핑하여 toast. **`error.message` / `data.message` 직접 toast 금지** — SQL 구문 / 스택 / 내부 식별자 누출 위험.

**Why**:

- **react-hook-form 채택**: uncontrolled form → 리렌더 최소화 + zod 통합. 자체 useState 폼 대비 valida tion 로직 통일 + 타입 안전. shadcn `Form` 가 thin wrapper 라 lock-in 없음
- **sonner 채택**: 자체 toast 구현 회피 (~6KB), shadcn 공식 권장. dark/light 자동 (theme="system")
- **단일 소스 og-palette**: plan021 의 `OG_CATEGORY_HEX` 와 댓글 Avatar 팔레트가 같은 색이어야 — 색 변경 시 한 파일만 수정. 단 server-only deps 격리 위해 pure module 로 분리
- **단방향 escape**: React 가 이미 한 번 escape 하므로 read 시점 unescape = 이중 escape → `&amp;lt;` 같은 잘못된 표시. 저장 시 1회만 적용이 정답. dompurify 같은 풀 라이브러리 회피 — 댓글은 markdown 미지원 plain text 라 5문자 escape 면 충분
- **USER_FRIENDLY_ERRORS 화이트리스트**: 서버 raw error 노출은 SQL injection probe / 정보 노출 공격면 확장. code 필드 명시적 매핑이 모든 메시지의 단일 진입점

**Scope 명시**: 이 ADR 의 정책은 댓글 영역 한정. 다른 client form (검색 dialog, 향후 로그인) 도입 시 이 결정을 ADR-021 의 패턴으로 따른다 (rhf + zod + sonner + USER_FRIENDLY_ERRORS).
