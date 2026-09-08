import { describe, expect, it, vi } from "vitest";
import { authorizeStudyRequest, StudyAuthError, type StudyAccess } from "./auth";

const token = "service-test-token-that-is-at-least-32-bytes";
const authenticated = async () => ({
  status: "authenticated" as const,
  data: { user: { id: "user", name: "관리자" }, session: { id: "session", expiresAt: new Date() } },
});

function request(headers: HeadersInit = {}) {
  return new Request("https://blog.example.test/api/study/v1/materials", { headers });
}

describe("학습자료 API 인증", () => {
  it("유효한 Bearer를 서비스 주체로 판정한다", async () => {
    await expect(authorizeStudyRequest(request({ authorization: `Bearer ${token}` }), "service", {
      serviceToken: token,
    })).resolves.toEqual({ kind: "service" });
  });

  it("잘못된 Bearer가 있으면 유효한 세션으로 우회하지 않는다", async () => {
    const getSession = vi.fn(authenticated);
    await expect(authorizeStudyRequest(request({ authorization: "Bearer wrong" }), "service-or-admin", {
      serviceToken: token,
      getSession,
    })).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each<[StudyAccess, number]>([["admin-read", 403], ["admin-write", 403]])(
    "서비스 주체의 %s 요청을 거절한다",
    async (access, status) => {
      await expect(authorizeStudyRequest(request({ authorization: `Bearer ${token}` }), access, {
        serviceToken: token,
      })).rejects.toMatchObject({ status, code: "FORBIDDEN" });
    },
  );

  it("브라우저 쓰기는 유효한 세션과 정확한 Origin을 요구한다", async () => {
    await expect(authorizeStudyRequest(request({ origin: "https://blog.example.test" }), "admin-write", {
      siteOrigin: "https://blog.example.test",
      getSession: authenticated,
    })).resolves.toEqual({ kind: "admin", ownerKey: "owner" });
    await expect(authorizeStudyRequest(request({ origin: "https://evil.example.test" }), "admin-write", {
      siteOrigin: "https://blog.example.test",
      getSession: authenticated,
    })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("관리자 세션의 수집 요청을 403으로 거절한다", async () => {
    await expect(authorizeStudyRequest(request(), "service", {
      getSession: authenticated,
    })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("세션 DB 장애를 익명 요청과 구분한다", async () => {
    await expect(authorizeStudyRequest(request(), "admin-read", {
      getSession: async () => ({ status: "unavailable", reason: "database" }),
    })).rejects.toBeInstanceOf(StudyAuthError);
    await expect(authorizeStudyRequest(request(), "admin-read", {
      getSession: async () => ({ status: "unavailable", reason: "database" }),
    })).rejects.toMatchObject({ status: 503, code: "UNAVAILABLE" });
  });
});
