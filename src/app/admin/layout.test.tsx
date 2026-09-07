// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "https://example.test" } }));

import AdminLayout, { dynamic, metadata } from "./layout";
import nextConfig from "../../../next.config";

describe("관리자 공통 레이아웃", () => {
  it("로그인과 빈 화면도 세션 요구 없이 렌더링하고 공개 장식·광고를 포함하지 않는다", () => {
    for (const children of [<button key="login">GitHub으로 로그인</button>, null]) {
      const dom = new DOMParser().parseFromString(renderToStaticMarkup(
        <AdminLayout>{children}</AdminLayout>,
      ), "text/html");

      expect(dom.querySelector("main")).not.toBeNull();
      expect(dom.querySelector("header, aside, footer")).toBeNull();
      expect(dom.querySelector('script[src*="googlesyndication"], meta[name="google-adsense-account"], ins.adsbygoogle')).toBeNull();
      expect(dom.querySelector("button")?.textContent ?? null).toBe(children ? "GitHub으로 로그인" : null);
    }
  });

  it("관리자 HTML과 RSC를 동적으로 렌더링하고 공개 metadata를 상속하지 않는다", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
    expect(metadata.openGraph).toEqual({ images: [] });
    expect(metadata.twitter).toEqual({ images: [] });
  });

  it("관리자·인증·자료 경로의 404와 오류에도 개인 캐시·색인 금지 헤더를 지정한다", async () => {
    const rules = await nextConfig.headers?.();

    for (const source of ["/admin/:path*", "/api/auth/:path*", "/api/study/:path*"]) {
      expect(rules?.find((rule) => rule.source === source)?.headers).toEqual([
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ]);
    }
    expect(rules?.some((rule) => rule.source === "/:path*")).toBe(false);
  });
});
