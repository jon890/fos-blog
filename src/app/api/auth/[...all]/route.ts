import { toNextJsHandler } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { AdminAuthConfigurationError, getAdminAuthContext, getAdminCallbackURL } from "@/lib/admin/auth";
import { getAdminSession } from "@/lib/admin/session";
import { authSession } from "@/infra/db/schema/auth";
import logger from "@/lib/logger";

const log = logger.child({ module: "api/auth" });
const allowedMethods: Record<string, string> = {
  "/api/auth/sign-in/social": "POST",
  "/api/auth/callback/github": "GET",
  "/api/auth/get-session": "GET",
  "/api/auth/sign-out": "POST",
};

function privateResponse(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function failure(status: number, code: string, message: string) {
  return privateResponse(Response.json({ code, message }, { status }));
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (allowedMethods[url.pathname] !== request.method) return failure(404, "NOT_FOUND", "지원하지 않는 인증 요청입니다.");
  try {
    const context = getAdminAuthContext();
    const { auth, db, config } = context;
    if (request.method === "POST" && request.headers.get("origin") !== config.baseURL) {
      return failure(403, "INVALID_ORIGIN", "요청 출처를 확인하지 못했습니다.");
    }
    if (url.pathname === "/api/auth/get-session") {
      const result = await getAdminSession(request.headers, context);
      if (result.status === "unauthenticated") return privateResponse(Response.json(null));
      if (result.status === "forbidden") return failure(403, "ADMIN_ACCOUNT_NOT_ALLOWED", "관리자 권한이 없는 계정입니다.");
      if (result.status === "unavailable") return failure(503, "AUTH_UNAVAILABLE", "관리자 세션을 확인하지 못했습니다.");
      return privateResponse(Response.json(result.data));
    }
    let forwarded = request;
    if (url.pathname === "/api/auth/sign-in/social") {
      let body: unknown;
      try { body = await request.json(); } catch { return failure(400, "INVALID_REQUEST", "로그인 요청이 올바르지 않습니다."); }
      if (!body || typeof body !== "object" || !("provider" in body) || body.provider !== "github") {
        return failure(400, "INVALID_PROVIDER", "GitHub 로그인만 사용할 수 있습니다.");
      }
      const callbackURL = getAdminCallbackURL("callbackURL" in body ? body.callbackURL : undefined, config.baseURL);
      // 추가 scope, idToken, state 데이터 등 클라이언트 지정 옵션은 전달하지 않는다.
      forwarded = new Request(request.url, {
        method: "POST", headers: new Headers(request.headers),
        body: JSON.stringify({ provider: "github", callbackURL, newUserCallbackURL: callbackURL,
          errorCallbackURL: `${config.baseURL}/admin/login`, disableRedirect: true }),
      });
      forwarded.headers.set("content-type", "application/json");
      forwarded.headers.delete("content-length");
    } else if (url.pathname === "/api/auth/sign-out") {
      // Better Auth 1.7.3 signOut은 DB 삭제 오류를 삼킨다. 먼저 삭제를 확정해
      // 실패 시 성공 응답이나 쿠키 삭제 없이 재시도할 수 있게 한다.
      const current = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
      if (current) await db.delete(authSession).where(eq(authSession.id, current.session.id));
      forwarded = new Request(request.url, { method: "POST", headers: new Headers(request.headers), body: "{}" });
      forwarded.headers.set("content-type", "application/json");
      forwarded.headers.delete("content-length");
    }
    const handlers = toNextJsHandler(auth);
    const response = await (request.method === "GET" ? handlers.GET(forwarded) : handlers.POST(forwarded));
    if (url.pathname === "/api/auth/callback/github") {
      const location = response.headers.get("location");
      if (location) {
        const destination = new URL(location, config.baseURL);
        const error = destination.searchParams.get("error");
        if (error || destination.pathname === "/admin/login") {
          const code = error === "access_denied" ? "access_denied"
            : error === "admin_account_not_allowed" || error === "account_not_linked"
              ? "admin_account_not_allowed" : "authentication_failed";
          response.headers.set("location", `${config.baseURL}/admin/login?error=${code}`);
        } else {
          response.headers.set("location", new URL(getAdminCallbackURL(location, config.baseURL), config.baseURL).href);
        }
      }
    }
    if (response.status >= 400) {
      return failure(response.status >= 500 ? 503 : response.status, "AUTH_REQUEST_FAILED", "인증 요청을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
    return privateResponse(response);
  } catch (error) {
    const configuration = error instanceof AdminAuthConfigurationError;
    if (!configuration) log.error("관리자 인증 요청 실패");
    return failure(503, "AUTH_UNAVAILABLE", configuration
      ? "관리자 인증 설정이 필요합니다." : "인증 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
