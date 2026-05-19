"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Lightbox } from "./Lightbox";

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
  const [state, setState] = useState<{
    images: { src: string; alt: string }[];
    index: number;
  } | null>(null);

  const open = useCallback((initialEl: HTMLElement) => {
    const root = articleRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-lightbox-image]")
    );
    const images = nodes.map((n) => ({
      src: n.dataset.lightboxSrc || "",
      alt: n.dataset.lightboxAlt || "",
    }));
    const index = nodes.indexOf(initialEl);
    if (index === -1) return; // trigger 요소가 scope 밖이면 미오픈 (방어)
    setState({ images, index });
  }, []);

  const close = useCallback(() => setState(null), []);

  const goto = useCallback(
    (i: number) =>
      setState((s) =>
        s
          ? {
              ...s,
              index: ((i % s.images.length) + s.images.length) % s.images.length,
            }
          : s
      ),
    []
  );

  return (
    <LightboxContext.Provider value={{ articleRef, open }}>
      <div ref={articleRef}>{children}</div>
      {state ? (
        <Lightbox
          images={state.images}
          index={state.index}
          onClose={close}
          onGoto={goto}
        />
      ) : null}
    </LightboxContext.Provider>
  );
}
