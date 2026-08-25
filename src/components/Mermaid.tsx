"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { Maximize2 } from "lucide-react";
import { MermaidZoomModal } from "./mermaid/MermaidZoomModal";

const ICON_SIZE_ZOOM = 16;

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>("");
  const [hasError, setHasError] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const { theme, systemTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 테마 설정 (시스템 테마 고려)
    const currentTheme = theme === "system" ? systemTheme : theme;

    const mermaidTheme = currentTheme === "dark" ? "dark" : "default";

    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: "loose",
      // fontFamily를 지정하지 않아 Mermaid 기본값(trebuchet ms)을 사용한다.
      // "inherit"으로 설정하면 Noto Sans KR의 글자 크기 계산이 달라 노드 내 텍스트가 잘린다.
    });

    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setHasError(false);
      } catch (error) {
        console.error("Failed to render mermaid chart:", error);
        // 에러 발생 시 원본 코드 표시
        setSvg(
          `<pre class="text-red-500">${error instanceof Error ? error.message : "Mermaid rendering error"}</pre>`,
        );
        setHasError(true);
      }
    };

    renderChart();
  }, [chart, theme, systemTheme]);

  const canZoom = Boolean(svg) && !hasError;

  return (
    <div className="my-8">
      <div
        ref={containerRef}
        className="mermaid flex justify-center overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* 다이어그램과 겹치지 않게 아래 줄에 둔다. 다이어그램이 낮으면 위에 겹친다. */}
      {canZoom && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)]"
            onClick={() => setIsZoomOpen(true)}
            aria-label="다이어그램 확대 보기"
          >
            <Maximize2 size={ICON_SIZE_ZOOM} />
            <span>확대</span>
          </button>
        </div>
      )}

      {isZoomOpen && (
        <MermaidZoomModal
          svg={svg}
          label="다이어그램 확대 보기"
          onClose={() => setIsZoomOpen(false)}
        />
      )}
    </div>
  );
}
