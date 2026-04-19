# Phase 02 — next/og 동적 OG 이미지 4개

## 컨텍스트 (자기완결 프롬프트)

phase-01 에서 만든 정적 자산(`logo.png`, `og-default.png`, `public/fonts/NotoSansKR-Bold-subset.woff2`) 을 활용해 **각 페이지가 자기 내용으로 렌더된 고유 OG 이미지** 를 런타임 생성한다. Next.js `next/og` `ImageResponse` + Node.js 런타임.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-007 (OG 전략), ADR-008 (폰트), ADR-009 (Node runtime)
- `src/lib/markdown.ts` — `extractDescription()` (line 77-100) — 발췌 추출
- `src/infra/db/repositories/PostRepository.ts:getPost()` — 글 데이터 조회
- `src/infra/db/repositories/CategoryRepository.ts:getCategories()` — 카테고리 조회
- `src/infra/db/constants` — `categoryIcons` 매핑 (카테고리 배지 아이콘)
- Next.js 공식 문서: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
- `src/infra/db/repositories/FolderRepository.ts:getFolderContents()` — 폴더 글 수

## 기존 코드 참조

- `src/app/posts/[...slug]/page.tsx` — 글 상세 `generateMetadata` (line 37-77). OG image는 `opengraph-image.tsx` 가 있으면 자동 override
- `src/app/category/[...path]/page.tsx` — 폴더 페이지 metadata
- `src/app/categories/page.tsx` — 카테고리 목록 metadata

## 작업 목록 (총 5개)

### 1. `src/lib/og.ts` 공용 유틸

파일: `src/lib/og.ts`

```ts
import fs from "node:fs/promises";
import path from "node:path";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export async function loadOgFont(): Promise<ArrayBuffer> {
  const fontPath = path.join(
    process.cwd(),
    "public/fonts/NotoSansKR-Bold-subset.woff2"
  );
  const buf = await fs.readFile(fontPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function loadOgLogoDataUrl(): Promise<string> {
  const logoPath = path.join(process.cwd(), "public/logo.png");
  const buf = await fs.readFile(logoPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * OG 이미지 영역에 들어가도록 문자열 길이 제한.
 * 한글 기준 120자 근처에서 잘라 "..." 추가.
 */
export function truncateForOg(text: string, max = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "...";
}

export const OG_COLORS = {
  bgGradientStart: "#1e1b4b",
  bgGradientMid: "#3b82f6",
  bgGradientEnd: "#8b5cf6",
  textPrimary: "#ffffff",
  textSecondary: "#cbd5e1",
  badgeBg: "rgba(255,255,255,0.12)",
  badgeBorder: "rgba(255,255,255,0.2)",
} as const;
```

- `loadOgFont` / `loadOgLogoDataUrl` 는 각 opengraph-image.tsx 에서 재사용
- `truncateForOg` 는 발췌 잘라주는 순수 함수

### 2. `src/app/opengraph-image.tsx` — 홈 동적 OG

파일: `src/app/opengraph-image.tsx`

```ts
import { ImageResponse } from "next/og";
import logger from "@/lib/logger";
import { OG_WIDTH, OG_HEIGHT, OG_COLORS, loadOgFont, loadOgLogoDataUrl } from "@/lib/og";

const log = logger.child({ module: "app/opengraph-image" });

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";
export const alt = "FOS Study — 개발 학습 블로그";

export default async function HomeOgImage() {
  let font: ArrayBuffer | null = null;
  let logo: string | null = null;
  try {
    [font, logo] = await Promise.all([loadOgFont(), loadOgLogoDataUrl()]);
  } catch (e) {
    log.warn(
      {
        component: "og-home",
        operation: "loadAssets",
        err: e instanceof Error ? e : new Error(String(e)),
      },
      "OG asset load failed, rendering text-only fallback"
    );
  }
  // JSX: 배경 그라디언트 + 좌측 텍스트(FOS Study / 개발 학습 블로그) + 좌하단 logo 48x48 (logo null 이면 텍스트만)
  return new ImageResponse(
    (/* ... */),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }]
        : [],
    }
  );
}
```

레이아웃:
- 배경: linear-gradient(135deg, OG_COLORS.bgGradientStart → Mid → End)
- 중앙 / 좌측 정렬 텍스트:
  - "FOS Study" (84px, bold, white)
  - "개발 학습 블로그" (40px, 얕은 white)
  - 하단 small tagline: "AI · Algorithm · Database · DevOps" (24px, textSecondary)
- 좌하단 48×48 logo (24px padding)

### 3. `/categories` + `/category/[...path]` OG 이미지

**파일 A**: `src/app/categories/opengraph-image.tsx`
- 제목: "카테고리"
- 서브: "{N}개의 카테고리" — `CategoryRepository.getCategories()` 실행 후 `categories.length`
- `export const runtime = "nodejs"`, `revalidate = 60`, `size`, `contentType`, `alt`

**파일 B**: `src/app/category/[...path]/opengraph-image.tsx`

```ts
interface Props {
  params: Promise<{ path: string[] }>;
}
export default async function CategoryOgImage({ params }: Props) {
  const { path: segments } = await params;
  const decoded = segments.map(decodeURIComponent);
  const folderPath = decoded.join("/");
  const current = decoded[decoded.length - 1];
  // folder.getFolderContents(folderPath) → posts.length, folders.length
  // ...
}
```

레이아웃 (공통):
- 배경: OG_COLORS 그라디언트
- 좌측 상단: breadcrumb "category > sub1 > sub2" (작게)
- 중앙: 카테고리 아이콘(이모지 또는 categoryIcons) + 이름 (72px)
- 하단: "{N}개의 글, {M}개의 폴더"
- 좌하단: 로고 48×48
- alt: `${currentFolder} | FOS Study`

에러 처리 (BLG2 4-field 로그 — 홈 OG와 동일 패턴):

```ts
import logger from "@/lib/logger";
const log = logger.child({ module: "app/category/opengraph-image" });

try {
  contents = await folder.getFolderContents(folderPath);
} catch (e) {
  log.warn(
    {
      component: "og-category",
      operation: "getFolderContents",
      folderPath,
      err: e instanceof Error ? e : new Error(String(e)),
    },
    "folder contents fetch failed, rendering fallback"
  );
  contents = { posts: [], folders: [] };
}
```

동일 fallback 규정을 `src/app/categories/opengraph-image.tsx`(파일 A) 에도 적용:
- `getCategories()` 실패 시 `[]` 로 fallback + 동일 BLG2 로그 (component: "og-categories", operation: "getCategories")

### 4. `/posts/[...slug]` OG 이미지 (핵심)

파일: `src/app/posts/[...slug]/opengraph-image.tsx`

```ts
import { ImageResponse } from "next/og";
import { getRepositories } from "@/infra/db/repositories";
import { extractTitle, extractDescription } from "@/lib/markdown";
import { categoryIcons, DEFAULT_CATEGORY_ICON } from "@/infra/db/constants";
import { OG_WIDTH, OG_HEIGHT, OG_COLORS, loadOgFont, loadOgLogoDataUrl, truncateForOg } from "@/lib/og";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateImageMetadata({ params }: Props) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  return [{ id: decoded, alt: "FOS Study 글 공유 이미지", ...size, contentType }];
}

export default async function PostOgImage({ params }: Props) {
  const { slug } = await params;
  const decoded = slug.map(decodeURIComponent).join("/");
  const { post } = getRepositories();
  const data = await post.getPost(decoded);
  // data null 이면 fallback — title "FOS Study"
  const title = data ? (extractTitle(data.content) || data.post.title) : "FOS Study";
  const description = data ? truncateForOg(extractDescription(data.content), 120) : "";
  const category = data?.post.category ?? "";
  const icon = categoryIcons[category] || DEFAULT_CATEGORY_ICON;
  // ...
}
```

레이아웃:
- 배경: OG_COLORS 그라디언트
- 상단 카테고리 배지: `{icon} {category}` — rounded pill, OG_COLORS.badgeBg
- 중앙 제목 (최대 2줄 wrap, 72px, bold, white, lineHeight 1.2)
- 하단 발췌 (truncateForOg 120자, 32px, textSecondary, lineHeight 1.5)
- 좌하단 로고 48×48
- `ImageResponse` fonts: Noto Sans KR Bold

DB 없거나 글 없는 경우 fallback (BLG2 4-field 로그):

```ts
import logger from "@/lib/logger";
const log = logger.child({ module: "app/posts/opengraph-image" });

let data: Awaited<ReturnType<typeof post.getPost>> = null;
try {
  data = await post.getPost(decoded);
} catch (e) {
  log.warn(
    {
      component: "og-post",
      operation: "getPost",
      slug: decoded,
      err: e instanceof Error ? e : new Error(String(e)),
    },
    "post fetch failed, using fallback"
  );
  data = null;
}
// data === null 이면: title = "FOS Study", description = "", category badge 미표시
```

### 5. 통합 검증 + 수동 확인 가이드

```bash
# cwd: <worktree root>

# 기본 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 빌드 산출물에 opengraph-image 포함 확인
find .next -name "opengraph-image*" | head -10

# standalone 에 폰트 / 로고 포함 확인 (Next.js standalone은 public/을 자동 복사하지 않음 — 배포 가이드 참조)
find .next/standalone -path "*fonts*" -name "*.woff2" | head
find .next/standalone -path "*public*" -name "logo.png" | head
```

**Next.js standalone 배포 가이드** (Dockerfile 또는 배포 스크립트에 반영 필수):
- `next build` + `output: "standalone"` 은 `public/` 디렉터리를 `.next/standalone/` 에 **자동 복사하지 않는다** (공식 quirk).
- Dockerfile 의 최종 스테이지에 아래가 이미 있거나 추가되어야 한다:
  ```dockerfile
  COPY --from=builder /app/public ./public
  ```
- 이 phase 에서는 Dockerfile 변경은 하지 않으며, 수동 확인 체크리스트에만 반영. 이미 `COPY public`이 있는지 `Dockerfile` 최상위 `grep "COPY.*public"` 로 확인.

수동 검증 가이드 (phase 성공 기준 이후 README 에 기록):
1. `pnpm start` 로 standalone 기동 (Dockerfile 빌드 경로 따를 경우 `public/` 수동 복사 확인)
2. `curl -I http://localhost:3000/opengraph-image` → 200, Content-Type: image/png
3. `curl -I http://localhost:3000/posts/<임의 글 slug>/opengraph-image` → 200
4. 브라우저에서 위 URL 접근 → 실제 렌더된 이미지 확인
5. 배포 후 https://www.opengraph.xyz/ 또는 Facebook Sharing Debugger 로 meta 검증

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 공용 유틸
test -f src/lib/og.ts
grep -n "export async function loadOgFont" src/lib/og.ts
grep -n "export function truncateForOg" src/lib/og.ts

# 2) opengraph-image 파일 4개 존재
test -f src/app/opengraph-image.tsx
test -f src/app/categories/opengraph-image.tsx
test -f src/app/category/[...path]/opengraph-image.tsx
test -f src/app/posts/[...slug]/opengraph-image.tsx

# 3) 런타임 명시 (ADR-009)
grep -l 'export const runtime = "nodejs"' \
  src/app/opengraph-image.tsx \
  src/app/categories/opengraph-image.tsx \
  'src/app/category/[...path]/opengraph-image.tsx' \
  'src/app/posts/[...slug]/opengraph-image.tsx'

# 4) ISR 60초 (ADR-007 / Q8)
for f in src/app/opengraph-image.tsx src/app/categories/opengraph-image.tsx 'src/app/category/[...path]/opengraph-image.tsx' 'src/app/posts/[...slug]/opengraph-image.tsx'; do
  grep -n "revalidate = 60" "$f"
done

# 5) ImageResponse 사용 + fonts 옵션
grep -l "new ImageResponse" src/app/opengraph-image.tsx src/app/categories/opengraph-image.tsx 'src/app/category/[...path]/opengraph-image.tsx' 'src/app/posts/[...slug]/opengraph-image.tsx'
grep -l "fonts:" src/app/opengraph-image.tsx

# 6) BLG2 구조화 로그 (4개 OG 파일 모두 DB/자산 실패 fallback 로그 포함)
#    - codebase 관례: `const log = logger.child(...)` + `log.warn({ ... component, operation, err }, "msg")`
#    - 4개 파일 모두 component + operation 필드 포함 검증 (multi-line tolerant: -P + (?s) 대신 존재 여부만)
for f in src/app/opengraph-image.tsx src/app/categories/opengraph-image.tsx 'src/app/category/[...path]/opengraph-image.tsx' 'src/app/posts/[...slug]/opengraph-image.tsx'; do
  grep -q 'logger.child' "$f" || { echo "[FAIL] $f: missing logger.child"; exit 1; }
  grep -q 'component:' "$f" || { echo "[FAIL] $f: missing component field"; exit 1; }
  grep -q 'operation:' "$f" || { echo "[FAIL] $f: missing operation field"; exit 1; }
  grep -qE 'log\.(warn|error)\(' "$f" || { echo "[FAIL] $f: missing log.warn/error call"; exit 1; }
done

# 7) 금지사항
! grep -nE "console\.(log|info|warn)" src/app/opengraph-image.tsx src/app/categories/opengraph-image.tsx 'src/app/category/[...path]/opengraph-image.tsx' 'src/app/posts/[...slug]/opengraph-image.tsx' src/lib/og.ts
! grep -nE "as any" src/lib/og.ts 'src/app/posts/[...slug]/opengraph-image.tsx'

# 8) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 9) 빌드 산출물
find .next -name "opengraph-image*" | grep -q opengraph-image
```

## PHASE_BLOCKED 조건

- `next/og` import 가 Next.js 16 에서 경로 변경됨 → **PHASE_BLOCKED: Next.js 16 공식 문서 확인 필요**
- Node runtime 에서 `ImageResponse` 가 예상과 다르게 동작 (standalone 빌드 에러) → **PHASE_BLOCKED: Edge runtime 전환 또는 정적 사전 생성 전략 재검토**
- 한글 렌더가 `□` (tofu) 로 표시됨 → **PHASE_BLOCKED: 폰트 subset 이 필요한 글자를 포함하지 못함. subset unicode range 재검토**

## 완료 후 team-lead 처리

- 통합 검증 재확인 (`pnpm lint && pnpm type-check && pnpm test --run && pnpm build`)
- 커밋 권장 분리 (atomic commits):
  - `chore(og): add pyftsubset script + subset font` (phase-01 1~2)
  - `fix(seo): correct ArticleJsonLd publisher.logo url + dimensions`
  - `feat(seo): add default og-default image to root metadata`
  - `feat(og): add next/og dynamic opengraph images (home/categories/category/posts)`
- PR 제목: `feat(seo): add dynamic OG images + fix Article JSON-LD publisher logo`
- PR 본문에 phase 구조 요약 + 수동 검증 체크리스트 포함
- index.json `status: "completed"` 갱신 + 커밋 + push

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다.
