---
name: page-impl
description: |
  docs/pages/ 의 PRD 문서를 기반으로 신규 페이지를 구현하거나 기존 페이지를 PRD에 맞게 수정하는 스킬.
  다음 상황에서 반드시 이 스킬을 사용한다:
  - "page-impl", "PRD로 구현해줘", "PRD 기반으로 페이지 만들어줘"
  - "이 PRD 보고 코드 짜줘", "문서 보고 페이지 구현해줘", "PRD → 코드"
  - "page-prd 만든 거 이제 구현해줘", "스펙 문서 있으니까 이제 만들어줘"
  - PRD 문서가 docs/pages/ 에 있고 구현 작업을 시작하는 모든 상황
  항상 PRD 문서(docs/pages/<name>.md)가 먼저 존재해야 한다.
  없으면 `/page-prd <name>` 을 먼저 실행하도록 안내한다.
---

# page-impl — PRD 기반 페이지 구현

## 개요

`docs/pages/<page-name>.md` PRD를 읽고 페이지를 구현한다.
신규 페이지 생성과 기존 페이지의 PRD 반영 모두 처리한다.

**전제조건**: PRD 파일이 존재해야 한다.

```bash
ls docs/pages/
```

없으면 작업 중단 후 안내:
> "PRD 문서가 없습니다. `/page-prd <name>` 을 먼저 실행해 문서를 작성해주세요."

---

## 파일명 규칙 (page-prd와 동일)

| PRD 파일명 | 페이지 파일 |
|-----------|------------|
| `docs/pages/home.md` | `src/app/page.tsx` |
| `docs/pages/categories.md` | `src/app/categories/page.tsx` |
| `docs/pages/category-detail.md` | `src/app/category/[...path]/page.tsx` |
| `docs/pages/post-detail.md` | `src/app/posts/[...slug]/page.tsx` |
| `docs/pages/search.md` | `src/app/search/page.tsx` |

---

## 1단계: PRD 읽기 및 유사 패턴 파악

PRD에서 아래 항목을 파악한다:
- **Route** → 파일 경로 결정
- **Data** → import할 repository 메서드 확인
- **Components** → 재사용 가능 컴포넌트 vs 신규 작성 필요
- **Constraints** → ISR, auth, Edge Runtime 제약

**유사 페이지 찾기**: PRD의 데이터 패턴이나 컴포넌트가 기존 페이지와 비슷하면 해당 페이지를 참조 템플릿으로 읽는다.
기존 페이지 목록은 `src/app/` 디렉토리를 빠르게 확인한다.

---

## 2단계: 구현 계획 제시 및 확인

코드 작성 전에 아래 계획을 사용자에게 보여주고 승인을 받는다:

```
## 구현 계획 — <Page Name>

파일: src/app/<route>/page.tsx  [신규 생성 / 수정]

변경 파일:
1. src/app/<route>/page.tsx — 페이지 메인
2. src/components/<Name>.tsx — (신규 컴포넌트 필요 시만)
3. src/services/<Name>Service.ts — (복잡한 비즈니스 로직이 필요 시만)

재사용 컴포넌트: PostCard, CategoryList, ...
데이터: getRepositories() → post.getXxx()
참조 패턴: src/app/posts/[...slug]/page.tsx (유사 구조)

진행할까요?
```

**아키텍처 레이어 결정 기준:**
- **단순 조회** (1~2개 repository 메서드): 페이지에서 `getRepositories()` 직접 호출
- **복잡한 비즈니스 로직** (여러 repository 조합, 변환 로직): `src/services/` 에 Service 클래스 작성 후 페이지에서 호출
- 프로젝트 아키텍처: `app/ → services/ → infra/db+github/`

---

## 3단계: 코드 구현

### 핵심 원칙

**기존 컴포넌트 우선**: 신규 작성 전에 `src/components/` 를 확인한다.

**Server / Client Component 결정 기준:**
- **Server Component (기본)**: 데이터 페칭, DB 접근, `getRepositories()` 호출 — `"use client"` 없음
- **Client Component** (`"use client"` 필수): `useState`, `useEffect`, 이벤트 핸들러(`onClick` 등) 사용 시. 반드시 파일 첫 줄에 위치.
- 원칙: Server Component를 기본으로, 인터랙티브한 부분만 Client Component로 분리한다.

**에러 처리 패턴** — DB 에러 후 fallback을 반드시 명시한다:
```typescript
const log = logger.child({ module: "app/<route>" });

// 패턴 A — 데이터 없으면 404 (단일 리소스 조회)
let data = null;
try {
  const { post } = getRepositories();
  data = await post.getPost(slug);
} catch {
  notFound();
}
if (!data) notFound();

// 패턴 B — DB 없어도 빈 화면으로 폴백 (목록 페이지)
let items: ItemType[] = [];
try {
  const { xxx } = getRepositories();
  items = await xxx.getXxx();
} catch (error) {
  log.warn(
    { err: error instanceof Error ? error : new Error(String(error)) },
    "Database not available",
  );
}
```

PRD의 페이지 성격에 따라 패턴 A(상세 페이지) 또는 패턴 B(목록 페이지)를 선택한다.

**필수 적용 항목:**
- ISR: PRD의 revalidate 값으로 `export const revalidate = N`
- Metadata: `generateMetadata()` 또는 `export const metadata`
- 로깅: `logger.child({ module: 'app/<route>' })`, console.log 금지
- 환경변수: `import { env } from "@/env"`
- 타입: `@/infra/db/types` 에서 import, strict 준수

**신규 컴포넌트 작성 기준**: `src/components/` 에 없는 것만 작성.
props 인터페이스를 명확히 정의하고 named export 사용.

---

## 4단계: 검증

```bash
pnpm lint && pnpm type-check
```

에러가 있으면 수정 후 재실행. `--no-verify` 절대 금지.

---

## 5단계: PRD 동기화

구현 중 PRD와 다르게 결정한 사항(컴포넌트 변경, 데이터 소스 추가 등)이 있으면
`docs/pages/<page-name>.md` 의 해당 섹션을 갱신하고 `Updated:` 날짜를 오늘로 변경한다.
PRD와 코드가 일치하는 상태를 항상 유지한다.

---

## 6단계: 완료 보고

```
✅ 구현 완료 — <Page Name>

생성/수정 파일:
- src/app/<route>/page.tsx
- src/components/<Name>.tsx  (신규인 경우)

PRD 대비 변경사항:
- <있으면 기재, 없으면 "PRD 그대로 구현">

다음: `/commit-and-push` 로 커밋 및 PR 생성
```
