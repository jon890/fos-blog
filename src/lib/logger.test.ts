import { describe, it, expect } from "vitest";
import logger from "./logger";

describe("logger", () => {
  it("기본 로거가 생성되어야 한다", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("child 로거가 생성되어야 한다", () => {
    const child = logger.child({ module: "test" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });

  it("LOG_LEVEL 환경변수가 없으면 기본 레벨이 info여야 한다", () => {
    expect(logger.level).toBe("info");
  });
});
