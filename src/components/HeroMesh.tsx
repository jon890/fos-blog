import type { CSSProperties } from "react";

interface HeroMeshProps {
  /** 첫 stop 의 hue (degrees) — 카테고리/페이지별 변형 시 활용. 기본 195 (brand cyan) */
  primaryHue?: number;
  /** 모션 강도 — "default" | "subtle" | "off". prefers-reduced-motion 자동 처리 */
  motion?: "default" | "subtle" | "off";
}

export function HeroMesh({ primaryHue = 195, motion = "default" }: HeroMeshProps) {
  const motionClass =
    motion === "off"
      ? "hero-mesh--no-motion"
      : motion === "subtle"
        ? "hero-mesh--subtle"
        : "hero-mesh--default";

  return (
    <div
      aria-hidden
      className={`hero-mesh ${motionClass}`}
      style={{ "--mesh-primary-hue": primaryHue } as CSSProperties}
    >
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="hero-mesh-svg">
        <defs>
          {/* 주의: SVG presentation attribute (stopColor=) 는 var() 해석 안 됨.
              CSS property 컨텍스트가 필요하므로 inline style 로 전달. */}
          <radialGradient id="mesh-stop-1" cx="20%" cy="30%" r="60%">
            <stop offset="0%" style={{ stopColor: "oklch(0.7 0.16 var(--mesh-primary-hue))", stopOpacity: 0.55 }} />
            <stop offset="60%" style={{ stopColor: "oklch(0.7 0.16 var(--mesh-primary-hue))", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="mesh-stop-2" cx="80%" cy="35%" r="55%">
            <stop offset="0%" style={{ stopColor: "var(--mesh-stop-03)", stopOpacity: 0.4 }} />
            <stop offset="60%" style={{ stopColor: "var(--mesh-stop-03)", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="mesh-stop-3" cx="50%" cy="80%" r="60%">
            <stop offset="0%" style={{ stopColor: "var(--mesh-stop-02)", stopOpacity: 0.45 }} />
            <stop offset="60%" style={{ stopColor: "var(--mesh-stop-02)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <rect className="mesh-layer mesh-layer-1" width="100" height="60" fill="url(#mesh-stop-1)" />
        <rect className="mesh-layer mesh-layer-2" width="100" height="60" fill="url(#mesh-stop-2)" />
        <rect className="mesh-layer mesh-layer-3" width="100" height="60" fill="url(#mesh-stop-3)" />
      </svg>
    </div>
  );
}
