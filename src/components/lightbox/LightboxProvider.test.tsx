// @vitest-environment jsdom

import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LightboxProvider } from "./LightboxProvider";
import { LightboxImage } from "./LightboxImage";

afterEach(() => {
  cleanup();
});

// next/image 는 jsdom 환경에서 SSR 분기 노이즈 발생 — 단순 <img> 로 mock
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

describe("LightboxProvider", () => {
  it("LightboxImage 클릭 시 lightbox 가 열린다", () => {
    render(
      <LightboxProvider>
        <LightboxImage src="/img1.jpg" alt="이미지1" />
        <LightboxImage src="/img2.jpg" alt="이미지2" />
      </LightboxProvider>
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("ESC 키로 닫힌다", () => {
    render(
      <LightboxProvider>
        <LightboxImage src="/img.jpg" alt="이미지" />
      </LightboxProvider>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ArrowRight / ArrowLeft 로 prev/next 전환 (wrap-around)", () => {
    render(
      <LightboxProvider>
        <LightboxImage src="/img1.jpg" alt="이미지1" />
        <LightboxImage src="/img2.jpg" alt="이미지2" />
        <LightboxImage src="/img3.jpg" alt="이미지3" />
      </LightboxProvider>
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // index 0 → "1 / 3"
    expect(screen.queryByText("1 / 3")).not.toBeNull();

    fireEvent.keyDown(document, { key: "ArrowRight" }); // → index 1
    expect(screen.queryByText("2 / 3")).not.toBeNull();

    fireEvent.keyDown(document, { key: "ArrowLeft" }); // → index 0
    expect(screen.queryByText("1 / 3")).not.toBeNull();

    fireEvent.keyDown(document, { key: "ArrowLeft" }); // wrap-around → index 2
    expect(screen.queryByText("3 / 3")).not.toBeNull();
  });

  it("이미지 1장만 있으면 prev/next 버튼/카운터 미렌더", () => {
    render(
      <LightboxProvider>
        <LightboxImage src="/img.jpg" alt="이미지" />
      </LightboxProvider>
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(screen.queryByLabelText("이전 이미지")).toBeNull();
    expect(screen.queryByLabelText("다음 이미지")).toBeNull();
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
  });

  it("배경 클릭 시 닫힌다", () => {
    render(
      <LightboxProvider>
        <LightboxImage src="/img.jpg" alt="이미지" />
      </LightboxProvider>
    );

    fireEvent.click(screen.getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toBeNull();

    // 배경(backdrop) 을 직접 클릭 — target === currentTarget 조건 충족 → onClose 호출
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("linked image 클릭 시 lightbox 미오픈 (closest('a') 가드)", () => {
    render(
      <LightboxProvider>
        <a href="http://example.com">
          <LightboxImage src="/img.jpg" alt="linked" />
        </a>
      </LightboxProvider>
    );

    fireEvent.click(screen.getByRole("button"));
    // <a> 조상이 있으므로 open() 호출되지 않아야 함
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
