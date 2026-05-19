"use client";

import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const ICON_SIZE_CLOSE = 28;
const ICON_SIZE_NAV = 36;

type LightboxProps = {
  images: { src: string; alt: string }[];
  index: number;
  onClose: () => void;
  onGoto: (next: number) => void;
};

export function Lightbox({ images, index, onClose, onGoto }: LightboxProps) {
  const current = images[index];
  const hasMultiple = images.length > 1;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const prev = hasMultiple ? images[(index - 1 + images.length) % images.length] : null;
  const next = hasMultiple ? images[(index + 1) % images.length] : null;

  // mount/unmount 전용 — 이전 포커스 캡처 + scroll lock + unmount 시 trigger 복귀
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, []);

  // keyboard handler — index 변경 시 latest closure 반영
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        onGoto(index - 1);
      } else if (e.key === "ArrowRight" && hasMultiple) {
        onGoto(index + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [index, hasMultiple, onClose, onGoto]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대 보기"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 닫기 버튼 */}
      <button
        ref={closeButtonRef}
        className="absolute top-4 right-4 z-10 text-white/80 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        <X size={ICON_SIZE_CLOSE} />
      </button>

      {/* prev 버튼 */}
      {hasMultiple && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white transition-colors"
          onClick={() => onGoto(index - 1)}
          aria-label="이전 이미지"
        >
          <ChevronLeft size={ICON_SIZE_NAV} />
        </button>
      )}

      {/* next 버튼 */}
      {hasMultiple && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white transition-colors"
          onClick={() => onGoto(index + 1)}
          aria-label="다음 이미지"
        >
          <ChevronRight size={ICON_SIZE_NAV} />
        </button>
      )}

      {/* 카운터 */}
      {hasMultiple && (
        <div className="absolute bottom-4 right-4 z-10 text-white/70 text-sm select-none">
          {index + 1} / {images.length}
        </div>
      )}

      {/* 이미지 — pointer-events-none 으로 버튼 클릭 가로채임 방지 */}
      <div className="relative w-full h-full flex items-center justify-center p-8 pointer-events-none">
        <img
          src={current.src}
          alt={current.alt}
          className="max-w-full max-h-full object-contain pointer-events-auto"
        />
      </div>

      {/* 인접 ±1 prefetch */}
      {prev && <img className="hidden" src={prev.src} alt="" aria-hidden="true" />}
      {next && <img className="hidden" src={next.src} alt="" aria-hidden="true" />}
    </div>
  );
}
