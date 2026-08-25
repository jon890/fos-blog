"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 12;
const MAX_INITIAL_SCALE = 6;
const SCALE_STEP = 1.5;
const WHEEL_SENSITIVITY = 0.0015;
const ICON_SIZE = 22;
const ICON_SIZE_CLOSE = 26;

type Transform = { scale: number; x: number; y: number };

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * 확대 중심(p)을 화면에 고정한 채 scale 만 바꾼다.
 * transform 은 `translate(x, y) scale(s)` 순서이므로 screen = x + s * c 이고,
 * 같은 컨텐츠 좌표 c 를 같은 p 에 남기려면 x' = p - s' * (p - x) / s 다.
 * p 는 스테이지 중심을 원점으로 하는 좌표다.
 */
function zoomAt(t: Transform, nextScale: number, px: number, py: number): Transform {
  const scale = clampScale(nextScale);
  return {
    scale,
    x: px - ((px - t.x) * scale) / t.scale,
    y: py - ((py - t.y) * scale) / t.scale,
  };
}

type MermaidZoomModalProps = {
  svg: string;
  label: string;
  onClose: () => void;
};

/** 확대 transform 을 걷어낸 svg 배치 크기와 원본 크기. 모달을 여는 순간 한 번만 잰다. */
type Metrics = { layoutWidth: number; layoutHeight: number; intrinsicWidth: number };

function measure(node: SVGSVGElement, currentScale: number): Metrics | null {
  const intrinsicWidth = node.viewBox?.baseVal?.width || 0;
  const rect = node.getBoundingClientRect();
  if (intrinsicWidth <= 0 || currentScale <= 0) return null;

  const layoutWidth = rect.width / currentScale;
  const layoutHeight = rect.height / currentScale;
  if (layoutWidth <= 0 || layoutHeight <= 0) return null;

  return { layoutWidth, layoutHeight, intrinsicWidth };
}

/**
 * 모달을 열었을 때의 배율과 위치.
 *
 * CSS 가 svg 를 스테이지에 맞추며 줄인 만큼을 세 후보 중 가장 큰 것으로 되돌린다.
 * 좁은 화면에서 잘게 줄어든 다이어그램은 원본 픽셀 크기까지 키우고,
 * 스테이지보다 작은 다이어그램은 남은 여백까지 채운다.
 * 확대한 결과가 스테이지를 넘치면 시작점(왼쪽 위)이 먼저 보이도록 밀어 둔다.
 */
function computeInitial(m: Metrics, stageRect: DOMRect): Transform {
  const toOriginalSize = m.intrinsicWidth / m.layoutWidth;
  const fillStage = Math.min(
    stageRect.width / m.layoutWidth,
    stageRect.height / m.layoutHeight,
  );
  const scale = clampScale(
    Math.min(Math.max(toOriginalSize, fillStage, 1), MAX_INITIAL_SCALE),
  );

  return {
    scale,
    x: Math.max(0, (m.layoutWidth * scale - stageRect.width) / 2),
    y: Math.max(0, (m.layoutHeight * scale - stageRect.height) / 2),
  };
}

export function MermaidZoomModal({ svg, label, onClose }: MermaidZoomModalProps) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  // 모달을 열었을 때의 배율. 배율 표시가 이 값을 100% 로 삼는다.
  const [baseScale, setBaseScale] = useState(1);
  const baseScaleRef = useRef(1);
  const metricsRef = useRef<Metrics | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 진행 중인 pointer 위치. 1개면 이동, 2개면 손가락 확대.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const transformRef = useRef<Transform>(IDENTITY);
  transformRef.current = transform;

  // 스테이지 중심을 원점으로 하는 좌표로 변환
  const toStagePoint = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }, []);

  const zoomByStep = useCallback((factor: number) => {
    setTransform((t) => zoomAt(t, t.scale * factor, 0, 0));
  }, []);

  const applyInitial = useCallback(() => {
    const stage = stageRef.current;
    const node = stage?.querySelector("svg");
    // 첫 측정값을 재사용한다. 확대한 뒤 다시 재면 transform 이 섞여 배율이 조금씩 어긋난다.
    const metrics =
      metricsRef.current ??
      (node ? measure(node, transformRef.current.scale) : null);

    if (!stage || !metrics) {
      // 크기를 재지 못하면 배율만 처음 값으로 되돌린다.
      setTransform({ ...IDENTITY, scale: baseScaleRef.current });
      return;
    }

    metricsRef.current = metrics;
    const initial = computeInitial(metrics, stage.getBoundingClientRect());
    baseScaleRef.current = initial.scale;
    setBaseScale(initial.scale);
    setTransform(initial);
  }, []);

  const reset = useCallback(() => applyInitial(), [applyInitial]);

  useEffect(() => {
    metricsRef.current = null;
    applyInitial();
  }, [applyInitial, svg]);

  // 이전 포커스 보존 + 배경 스크롤 잠금
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        zoomByStep(SCALE_STEP);
      } else if (e.key === "-" || e.key === "_") {
        zoomByStep(1 / SCALE_STEP);
      } else if (e.key === "0") {
        reset();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, zoomByStep, reset]);

  // React 의 onWheel 은 passive 로 등록되어 preventDefault 가 먹지 않는다.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toStagePoint(e.clientX, e.clientY);
      const current = transformRef.current;
      const next = current.scale * Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      setTransform(zoomAt(current, next, p.x, p.y));
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [toStagePoint]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchRef.current = null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    const previous = pointers.get(e.pointerId);
    if (!previous) return;

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const dx = e.clientX - previous.x;
      const dy = e.clientY - previous.y;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      return;
    }

    if (pointers.size >= 2) {
      const [a, b] = Array.from(pointers.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance === 0) return;

      if (!pinchRef.current) {
        pinchRef.current = { distance, scale: transformRef.current.scale };
        return;
      }

      const center = toStagePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      const ratio = distance / pinchRef.current.distance;
      setTransform((t) =>
        zoomAt(t, pinchRef.current!.scale * ratio, center.x, center.y),
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-[var(--color-bg-base)]/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* 컨트롤 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        <button
          type="button"
          className="rounded-md p-2 text-[var(--color-fg-secondary)] transition-colors hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg-primary)]"
          onClick={() => zoomByStep(1 / SCALE_STEP)}
          aria-label="축소"
        >
          <Minus size={ICON_SIZE} />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-[var(--color-fg-secondary)] transition-colors hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg-primary)]"
          onClick={() => zoomByStep(SCALE_STEP)}
          aria-label="확대"
        >
          <Plus size={ICON_SIZE} />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-[var(--color-fg-secondary)] transition-colors hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg-primary)]"
          onClick={reset}
          aria-label="원래 크기로"
        >
          <RotateCcw size={ICON_SIZE} />
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          className="rounded-md p-2 text-[var(--color-fg-secondary)] transition-colors hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg-primary)]"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={ICON_SIZE_CLOSE} />
        </button>
      </div>

      {/* 배율 표시 */}
      <div className="absolute bottom-4 right-4 z-10 select-none text-sm text-[var(--color-fg-muted)]">
        {Math.round((transform.scale / baseScale) * 100)}%
      </div>

      <div className="absolute bottom-4 left-4 z-10 hidden select-none text-sm text-[var(--color-fg-muted)] sm:block">
        휠이나 두 손가락으로 확대하고 끌어서 이동한다. ESC 로 닫는다.
      </div>

      <div
        ref={stageRef}
        className="mermaid-zoom-stage h-full w-full touch-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: transform.scale > 1 ? "grab" : "default" }}
      >
        <div
          className="flex h-full w-full items-center justify-center p-6"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "center center",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
