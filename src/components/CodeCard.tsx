"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeCardProps {
  filename?: string;
  language?: string;
  /** 클립보드 복사용 원본 텍스트 */
  rawCode: string;
  variant?: "code" | "diff" | "terminal";
  children: React.ReactNode;
}

const COPY_TIMEOUT_MS = 2000;

export function CodeCard({
  filename,
  language,
  rawCode,
  variant = "code",
  children,
}: CodeCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(rawCode).then(
      () => {
        setCopied(true);
        const t = setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
        return () => clearTimeout(t);
      },
      () => {
        // 복사 실패 — 사용자에게는 ARIA live region 으로 통지 (alert 금지)
        setCopied(false);
      },
    );
  }, [rawCode]);

  return (
    <figure
      className={cn(
        "code-card my-6",
        variant === "terminal" && "code-card--terminal",
      )}
    >
      <header className="code-card-head">
        <div className="left">
          {language && <span className="lang">{language}</span>}
          {filename && <span className="filename">{filename}</span>}
        </div>
        <div className="right">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            aria-label={copied ? "복사됨" : "코드 복사"}
            className="cb-btn"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="sr-only md:not-sr-only md:ml-1.5">
              {copied ? "copied" : "copy"}
            </span>
          </Button>
          {/* copied 상태를 스크린리더에 통지 */}
          <span aria-live="polite" className="sr-only">
            {copied ? "코드가 클립보드에 복사되었습니다" : ""}
          </span>
        </div>
      </header>
      <div className="code-card-body">{children}</div>
    </figure>
  );
}
