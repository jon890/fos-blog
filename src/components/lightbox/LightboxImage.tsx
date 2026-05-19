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
      onClick={(e) => {
        // linked image (`[![alt](src)](url)`) 안에서는 lightbox 비활성 — 링크 네비게이션 우선
        if (e.currentTarget.closest("a")) return;
        if (ref.current) open(ref.current);
      }}
      className="block cursor-zoom-in"
      role="button"
      aria-label={`${alt || "이미지"} 확대`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.currentTarget.closest("a")) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (ref.current) open(ref.current);
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
