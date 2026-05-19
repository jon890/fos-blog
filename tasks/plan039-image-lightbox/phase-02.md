# Phase 02 — MarkdownRenderer + page.tsx 통합

**Model**: sonnet
**Status**: pending

---

## 목표

phase 01 의 Lightbox 컴포넌트 3종을 실제 본문 렌더 경로에 연결한다.
`<article>` 안의 모든 `<img>` 가 lightbox 트리거가 되도록 wrapper 교체 + Provider mount.

**범위 외**: 회귀 테스트 (phase 03), 신규 lightbox 컴포넌트 작성 (phase 01).
docs 갱신은 planning 단계에서 이미 완료 (CLAUDE.md "docs 최신화는 task 생성 전 필수") — phase 안에서 docs 수정 금지.

---

## 작업 항목 (2)

### 1. `src/components/markdown/components.tsx` — img 컴포넌트 LightboxImage 로 교체

기존 (L237-249):
```tsx
img: ({ src, alt }) => {
  if (typeof src !== "string" || !src) return null;
  return (
    <Image
      src={src}
      alt={alt || ""}
      width={0}
      height={0}
      sizes="100vw"
      className="my-4 rounded-lg shadow-lg w-full h-auto"
    />
  );
},
```

변경:
```tsx
img: ({ src, alt }) => {
  if (typeof src !== "string" || !src) return null;
  return <LightboxImage src={src} alt={alt || ""} />;
},
```

상단 import 추가:
```tsx
import { LightboxImage } from "@/components/lightbox/LightboxImage";
```

기존 `import Image from "next/image"` 는 다른 곳 사용 여부 확인 후 정리:
```bash
grep -nE "<Image\b" src/components/markdown/components.tsx
# 사용처 0건 → import 삭제
# 사용처 있음 → import 유지
```

### 2. `src/app/posts/[...slug]/page.tsx` — article 안 LightboxProvider mount

현재 L208-210:
```tsx
<article className="min-w-0">
  <MarkdownRenderer content={stripped} basePath={slug} />
</article>
```

변경:
```tsx
<article className="min-w-0">
  <LightboxProvider>
    <MarkdownRenderer content={stripped} basePath={slug} />
  </LightboxProvider>
</article>
```

상단 import 추가:
```tsx
import { LightboxProvider } from "@/components/lightbox/LightboxProvider";
```

배치 이유: Provider 가 `<MarkdownRenderer>` 만 감싸 article scope 내 이미지로 한정. ArticleHero/ArticleFooter/Comments 등 외부 이미지는 lightbox 대상 외 (의도).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/markdown/components.tsx` | 수정 (img 컴포넌트 교체 + import 정리) |
| `src/app/posts/[...slug]/page.tsx` | 수정 (LightboxProvider mount + import 추가) |

## 검증

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check

# img 가 LightboxImage 로 교체됐는가
grep -nE "<Image\b" src/components/markdown/components.tsx
# 기대: img 핸들러 안 0건 (import 외 사용 0건이어야 함. 다른 핸들러에서 Image 쓰면 OK)

grep -nE "\bLightboxImage\b" src/components/markdown/components.tsx | wc -l
# 기대: ≥ 2 (import + 사용 라인)

# page.tsx LightboxProvider mount
grep -nE "\bLightboxProvider\b" "src/app/posts/[...slug]/page.tsx" | wc -l
# 기대: ≥ 2 (import + JSX)
```

수동 smoke (`pnpm dev`):
- `/posts/<이미지 있는 글 slug>` — 본문 이미지에 cursor-zoom-in 마우스 + 클릭 시 lightbox open
- 이미지 2장 이상인 글: ←/→ 키 + 좌우 버튼 prev/next
- ESC / 배경 클릭 → 닫힘
- 다크/라이트 모드 토글 양쪽에서 backdrop 자연

## 의도 메모 (왜)

- **Provider 위치 (article 안, MarkdownRenderer 만 감쌈)**: Hero / Footer / Comments 외부 이미지는 lightbox 대상 외 — UX scope 명확화. article scope = "본문" 의 일관 정의
- **import 정리**: 같은 파일에서 next/image 가 다른 곳 안 쓰이면 dead import. 실제로 unused 확인 후 삭제 (CLAUDE.md "외과적 변경" — 자기 변경이 만든 orphan 만 제거)
