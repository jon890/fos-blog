# Phase 01 — Lightbox 컴포넌트 + Provider + Image wrapper 신규

**Model**: sonnet
**Status**: pending

---

## 목표

본문 이미지 클릭 시 viewport 풀스크린 모달로 확대하는 Lightbox 의 client 컴포넌트 3종을 신규 작성한다.
글 안 다중 이미지를 화살표 키/버튼으로 prev/next 순회 가능하게 한다.
인접 ±1 이미지는 open 직후 hidden mount 로 prefetch.

**범위 외**: MarkdownRenderer 통합 (phase 02), 페이지 mount (phase 02), 회귀 테스트 (phase 03).
mermaid SVG 다이어그램 확대 — 이번 plan scope 외.

---

## 작업 항목 (3)

### 1. `src/components/lightbox/LightboxProvider.tsx` — context provider 신규

`"use client"`. children 을 감싸 lightbox state 와 article scope ref 를 제공.

```tsx
type LightboxContextValue = {
  articleRef: React.RefObject<HTMLDivElement | null>;
  open: (initialEl: HTMLElement) => void;
};

export const LightboxContext = createContext<LightboxContextValue | null>(null);

export function useLightbox(): LightboxContextValue {
  const v = useContext(LightboxContext);
  if (!v) throw new Error("useLightbox must be used inside <LightboxProvider>");
  return v;
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ images: { src: string; alt: string }[]; index: number } | null>(null);

  const open = useCallback((initialEl: HTMLElement) => {
    const root = articleRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-lightbox-image]"));
    const images = nodes.map((n) => ({ src: n.dataset.lightboxSrc || "", alt: n.dataset.lightboxAlt || "" }));
    const index = Math.max(0, nodes.indexOf(initialEl));
    setState({ images, index });
  }, []);

  const close = useCallback(() => setState(null), []);
  const goto = useCallback((i: number) => setState((s) => (s ? { ...s, index: ((i % s.images.length) + s.images.length) % s.images.length } : s)), []);

  return (
    <LightboxContext.Provider value={{ articleRef, open }}>
      <div ref={articleRef}>{children}</div>
      {state ? <Lightbox images={state.images} index={state.index} onClose={close} onGoto={goto} /> : null}
    </LightboxContext.Provider>
  );
}
```

핵심:
- `articleRef` 가 lightbox 의 scope 정의 — Provider 가 감싼 영역의 `data-lightbox-image` 만 수집
- open 시점에 DOM 쿼리로 순서 결정 (React state ref array 의 unmount 타이밍 사고 회피)
- index 는 modulo 로 wrap around

### 2. `src/components/lightbox/Lightbox.tsx` — 모달 본체 신규

`"use client"`. SearchDialog 패턴 (`src/components/SearchDialog.tsx`) 의 backdrop + scroll lock + ESC 그대로 채택.

Props:
```tsx
type LightboxProps = {
  images: { src: string; alt: string }[];
  index: number;
  onClose: () => void;
  onGoto: (next: number) => void;
};
```

요구사항:
- `fixed inset-0 z-[100]` 모달, 배경 `bg-black/85 backdrop-blur-sm`
- `document.body.style.overflow = "hidden"` 적용 + cleanup (SearchDialog L88-93 패턴 동일)
- ESC 키: 닫기. ArrowLeft / ArrowRight: `onGoto(index ± 1)` (images.length > 1 일 때만)
- 배경 클릭 (modal 영역 외 클릭): 닫기. e.target === currentTarget 검사
- 닫기 버튼 우상단 (`absolute top-4 right-4`, lucide `X` 아이콘, `aria-label="닫기"`)
- prev/next 버튼 좌우 중앙 (`absolute left-4 / right-4 top-1/2 -translate-y-1/2`, lucide `ChevronLeft` / `ChevronRight`, `aria-label="이전 이미지" / "다음 이미지"`). images.length === 1 일 때 미렌더
- 카운터 우하단 (`absolute bottom-4 right-4 text-white/70 text-sm`) — `${index + 1} / ${images.length}` — images.length > 1 일 때만
- 이미지 표시: 중앙 정렬 + viewport fit-contain. `next/image` 사용 + `sizes="100vw"` + `fill` + container `aspect-ratio` 보존
  - 컨테이너: `relative w-full h-full flex items-center justify-center p-8`
  - inner: `relative max-w-full max-h-full` + `Image fill style={{ objectFit: "contain" }}` — fill 은 absolute 라 부모가 relative + 명시 사이즈 필요 → inner 에 max-w/h-full + 명시 width/height 대신 직접 `<img>` 사용 검토
  - 결정: lightbox 의 이미지는 `<img>` (HTMLImageElement) 사용 — next/image fill 의 layout 제약 회피, srcset 은 본문에서 이미 캐시됨. ts: `<img src={images[index].src} alt={images[index].alt} className="max-w-full max-h-full object-contain" />`
- 인접 ±1 prefetch: `useEffect` 가 (index 변경 시) 인접 이미지를 hidden mount — `<img className="hidden" src={prev.src} /><img className="hidden" src={next.src} />`. images.length <= 1 일 땐 skip
- role + aria: 루트에 `role="dialog" aria-modal="true" aria-label="이미지 확대 보기"`. focus trap 은 OOS — ESC 만 강제

### 3. `src/components/lightbox/LightboxImage.tsx` — img wrapper 신규

`"use client"`. MarkdownRenderer 의 `img` 컴포넌트가 호출. 기존 `next/image` 렌더링을 유지하면서 클릭 핸들러 + data attribute 추가.

```tsx
"use client";
import Image from "next/image";
import { useRef } from "react";
import { useLightbox } from "./LightboxProvider";

export function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { open } = useLightbox();
  return (
    <span
      ref={ref}
      data-lightbox-image
      data-lightbox-src={src}
      data-lightbox-alt={alt}
      onClick={() => ref.current && open(ref.current)}
      className="block cursor-zoom-in"
      role="button"
      aria-label={`${alt || "이미지"} 확대`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ref.current && open(ref.current);
        }
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes="100vw"
        className="my-4 rounded-lg shadow-lg w-full h-auto"
      />
    </span>
  );
}
```

핵심:
- 기존 `MarkdownRenderer` 의 img 와 동일 next/image props 유지 (회귀 없음)
- `<span>` 래퍼 (`<div>` 는 prose 의 `<p>` 자식으로 들어가면 hydration mismatch — markdown 의 img 는 `<p>` 안에 inline 위치) — `display: block` 으로 보이는 동작은 동일
- `cursor-zoom-in` 으로 인터랙션 힌트
- 키보드 접근: tabIndex + Enter/Space 활성화

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/components/lightbox/LightboxProvider.tsx` | 신규 |
| `src/components/lightbox/Lightbox.tsx` | 신규 |
| `src/components/lightbox/LightboxImage.tsx` | 신규 |

## 검증

```bash
# cwd: <repo root>
# branch: feat/plan039-image-lightbox-impl (build-with-teams 자동 생성)
pnpm lint
pnpm type-check
pnpm test --run

# 신규 파일 확인
ls src/components/lightbox/
# 기대: Lightbox.tsx LightboxImage.tsx LightboxProvider.tsx

# "use client" 모두 명시
grep -l '"use client"' src/components/lightbox/*.tsx | wc -l
# 기대: 3

# context 누락 검출 0
grep -nE "useLightbox|LightboxContext" src/components/lightbox/*.tsx
# 기대: Provider/Image 양쪽 출현
```

## 의도 메모 (왜)

- **DOM 쿼리 기반 순서**: React state ref array 는 unmount 타이밍이 modal open 과 충돌해 stale snapshot 위험. `data-lightbox-image` attribute + open 시점 querySelectorAll 이 가장 robust
- **lightbox 본체에서 `<img>` 사용 (next/image 아님)**: next/image `fill` 은 absolute 라 부모 사이즈 강제 필요 — viewport-aware contain 과 충돌. 본문 이미지가 이미 next/image srcset 으로 큰 해상도까지 캐시되므로 같은 src 의 `<img>` 는 캐시 hit
- **인접 ±1 prefetch (B)**: 단순 hidden `<img>` mount — browser 가 자연스럽게 fetch. open 시점에 1회만 (대역폭 0~2장)
- **자체 구현**: shadcn + 자체 컴포넌트 일관성. yet-another-react-lightbox 의 +10KB 는 표준 scope 에 과잉. ADR 적격 아님 (자명성 게이트)
