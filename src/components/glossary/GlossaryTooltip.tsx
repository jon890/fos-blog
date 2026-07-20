"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const OPEN_EVENT = "glossary-tooltip-open";

type GlossaryTooltipProps = {
  id: string;
  term: string;
  fullName?: string | null;
  summary: string;
  children: React.ReactNode;
};

const TOOLTIP_WIDTH = 288;
const VIEWPORT_MARGIN = 16;

export function GlossaryTooltip({
  id,
  term,
  fullName,
  summary,
  children,
}: GlossaryTooltipProps) {
  const reactId = useId();
  const instanceId = `${id}-${reactId}`;
  const tooltipId = `glossary-tooltip-${instanceId}`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [tooltipLeft, setTooltipLeft] = useState(0);

  const show = useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const tooltipWidth = Math.min(
        TOOLTIP_WIDTH,
        window.innerWidth - VIEWPORT_MARGIN * 2,
      );
      const desiredViewportLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
      const viewportLeft = Math.min(
        Math.max(desiredViewportLeft, VIEWPORT_MARGIN),
        window.innerWidth - tooltipWidth - VIEWPORT_MARGIN,
      );
      setTooltipLeft(viewportLeft - triggerRect.left);
    }
    window.dispatchEvent(
      new CustomEvent<string>(OPEN_EVENT, { detail: instanceId }),
    );
    setOpen(true);
  }, [instanceId]);

  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      if (rootRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };

    window.addEventListener(OPEN_EVENT, handleOtherOpen);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOtherOpen);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [instanceId]);

  const title = fullName ? `${term} — ${fullName}: ${summary}` : `${term}: ${summary}`;

  return (
    <span
      ref={rootRef}
      className="relative inline"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <abbr
        ref={triggerRef}
        className="cursor-help decoration-dotted underline underline-offset-4"
        title={title}
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={show}
        onClick={show}
      >
        {children}
      </abbr>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{ left: tooltipLeft }}
          className="absolute bottom-full z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 text-left text-sm font-normal not-italic text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <span className="block font-semibold">
            {term}
            {fullName && <span className="ml-1 font-normal">({fullName})</span>}
          </span>
          <span className="mt-1 block leading-5">{summary}</span>
          <a
            className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400"
            href={`/glossary#${encodeURIComponent(id)}`}
          >
            용어집에서 보기
          </a>
        </span>
      )}
    </span>
  );
}
