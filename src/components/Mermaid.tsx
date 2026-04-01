"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const [svg, setSvg] = useState<string>("");
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
      } catch (error) {
        console.error("Failed to render mermaid chart:", error);
        // 에러 발생 시 원본 코드 표시
        setSvg(
          `<pre class="text-red-500">${error instanceof Error ? error.message : "Mermaid rendering error"}</pre>`,
        );
      }
    };

    renderChart();
  }, [chart, theme, systemTheme]);

  return (
    <div
      ref={containerRef}
      className="mermaid flex justify-center my-8 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
