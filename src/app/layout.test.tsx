// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const fixture = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "https://example.test",
    NEXT_PUBLIC_GOOGLE_ADSENSE_ID: "ca-pub-layout-fixture" as string | undefined,
  },
}));

vi.mock("@/env", () => fixture);
vi.mock("server-only", () => ({}));
vi.mock("@/infra/db/repositories", () => ({ getRepositories: vi.fn() }));
vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "font-sans" } }));
vi.mock("geist/font/mono", () => ({ GeistMono: { variable: "font-mono" } }));
vi.mock("sonner", () => ({ Toaster: () => <div data-testid="toaster" /> }));
vi.mock("@/components/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <div data-testid="theme">{children}</div>,
}));
vi.mock("@/components/SidebarContext", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
}));
vi.mock("@/components/Header", () => ({ Header: () => <header>공개 탐색</header> }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => <footer>공개 안내</footer> }));
vi.mock("@/app/components/FolderSidebarWrapper", () => ({
  FolderSidebarWrapper: () => <aside>공개 글 목록</aside>,
}));
vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => <script src={src} />,
}));

import RootLayout, { metadata as rootMetadata } from "./layout";
import BlogLayout, { metadata as blogMetadata } from "./(blog)/layout";
import { metadata as notFoundMetadata } from "./not-found";

const adsSelector = 'script[src*="googlesyndication"], meta[name="google-adsense-account"], ins.adsbygoogle';

function parseLayout(children: ReactNode) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<RootLayout>{children}</RootLayout>),
    "text/html",
  );
}

describe("공개 레이아웃 분리", () => {
  beforeEach(() => {
    fixture.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID = "ca-pub-layout-fixture";
  });

  it("루트는 테마·글꼴·알림과 자식을 유지하고 공개 장식과 광고를 렌더링하지 않는다", () => {
    const dom = parseLayout(<p>공통 화면</p>);

    expect(dom.documentElement.lang).toBe("ko");
    expect(dom.body.className).toBe("font-sans font-mono");
    expect(dom.querySelector('[data-testid="theme"]')?.textContent).toBe("공통 화면");
    expect(dom.querySelector('[data-testid="toaster"]')).not.toBeNull();
    expect(dom.querySelector("header, aside, footer, [data-testid=sidebar-provider]")).toBeNull();
    expect(dom.querySelectorAll(adsSelector)).toHaveLength(0);
  });

  it("공개 화면만 탐색·사이드바·푸터와 설정된 광고를 렌더링한다", () => {
    const dom = parseLayout(<BlogLayout><p>공개 본문</p></BlogLayout>);

    expect(dom.querySelector("header")?.textContent).toBe("공개 탐색");
    expect(dom.querySelector("aside")?.textContent).toBe("공개 글 목록");
    expect(dom.querySelector("footer")?.textContent).toBe("공개 안내");
    expect(dom.querySelector("main")?.textContent).toBe("공개 본문");
    expect(dom.querySelector('[data-testid="sidebar-provider"]')).not.toBeNull();
    expect(dom.querySelector('meta[name="google-adsense-account"]')?.getAttribute("content")).toBe("ca-pub-layout-fixture");
    expect(dom.querySelector('script[src*="googlesyndication"]')?.getAttribute("src")).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-layout-fixture",
    );
  });

  it("광고 설정이 없으면 공개 화면에서도 광고를 생략한다", () => {
    fixture.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID = undefined;
    const dom = parseLayout(<BlogLayout><p>공개 본문</p></BlogLayout>);

    expect(dom.querySelectorAll(adsSelector)).toHaveLength(0);
    expect(dom.querySelector("header")).not.toBeNull();
  });

  it("공개 canonical·색인·공유 이미지 기본값을 공개 route group에 유지한다", () => {
    expect(blogMetadata.metadataBase?.toString()).toBe("https://example.test/");
    expect(blogMetadata.alternates?.canonical).toBe("https://example.test");
    expect(blogMetadata.robots).toMatchObject({ index: true, follow: true });
    expect(blogMetadata.openGraph).toMatchObject({
      url: "https://example.test",
      images: [{ url: "https://example.test/og-default.png", width: 1200, height: 630, alt: "FOS Study — 개발 학습 블로그" }],
    });
    expect(rootMetadata.robots).toEqual({ index: false, follow: false });
    expect(rootMetadata.alternates).toBeNull();
    expect(rootMetadata.openGraph).toEqual({ images: [] });
    expect(rootMetadata.twitter).toEqual({ images: [] });
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: false });
    expect(notFoundMetadata.alternates).toBeNull();
    expect(notFoundMetadata.openGraph).toEqual({ images: [] });
    expect(notFoundMetadata.twitter).toEqual({ images: [] });
  });

  it("홈과 카테고리는 이동 전 공개 OG 이미지 경로를 사용한다", async () => {
    const { metadata: homeMetadata } = await import("./(blog)/page");
    const { metadata: categoriesMetadata } = await import("./(blog)/categories/page");

    expect(homeMetadata.openGraph).toMatchObject({
      title: "FOS Study - 개발 학습 블로그",
      url: "https://example.test",
      images: [{ url: "https://example.test/opengraph-image", width: 1200, height: 630 }],
    });
    expect(categoriesMetadata.openGraph).toMatchObject({
      images: [{ url: "https://example.test/categories/opengraph-image", width: 1200, height: 630 }],
    });
  });
});
