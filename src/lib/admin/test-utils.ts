import { inArray, eq, sql } from "drizzle-orm";
import { vi } from "vitest";
import { createTestDatabase } from "@/infra/db/test-utils";
import { authUser, authVerification } from "@/infra/db/schema/auth";
import { createAdminAuth, type AdminAuthConfig, type AdminAuthContext } from "./auth";

export const authTestConfig: AdminAuthConfig = {
  baseURL: "https://admin.example.test",
  secret: "test-only-9f8ab452c37de6018a94b79c021de5fa",
  githubClientId: "fixture-client-id",
  githubClientSecret: "fixture-client-secret",
  githubUserId: "424242",
};

export function responseCookies(response: Response): string {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

export async function createAuthFixture(label: string) {
  const database = await createTestDatabase();
  const email = `plan063-p2-${label}@example.test`;
  const states: string[] = [];
  let flowNumber = 0;
  const config = { ...authTestConfig };
  const context: AdminAuthContext = { db: database.db, config, auth: createAdminAuth(database.db, config) };
  const clean = async () => {
    await database.db.delete(authUser).where(eq(authUser.email, email));
    await database.db.delete(authVerification).where(eq(sql`CASE WHEN JSON_VALID(${authVerification.value}) THEN JSON_UNQUOTE(JSON_EXTRACT(${authVerification.value}, '$.link.email')) END`, email));
    if (states.length) await database.db.delete(authVerification).where(inArray(authVerification.identifier, states));
    states.length = 0;
  };
  await clean();

  const mockGitHub = (id: unknown = 424242, tokenError = false) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === "https://github.com/login/oauth/access_token") {
        return Response.json(tokenError ? { error: "invalid_grant", error_description: "PRIVATE_PROVIDER_DETAIL" }
          : { access_token: "PRIVATE_OAUTH_TOKEN", token_type: "bearer", scope: "read:user,user:email" });
      }
      if (url === "https://api.github.com/user") return Response.json({
        ...(id === null ? {} : { id }), email, login: "fixture-admin", name: "Fixture Admin", avatar_url: "https://example.test/avatar.png",
      });
      if (url === "https://api.github.com/user/emails") return Response.json([{ email, primary: true, verified: true }]);
      throw new Error("허용하지 않은 테스트 외부 요청");
    }));
  };
  const start = async (handler = context.auth.handler, body: Record<string, unknown> = {},
    options: { path?: string; cookie?: string; ipAddress?: string } = {}) => {
    // 서로 독립적인 브라우저 fixture로 취급하며 제품 rate limit은 유지한다.
    const ipAddress = options.ipAddress ?? `192.0.2.${++flowNumber}`;
    const response = await handler(new Request(`${config.baseURL}/api/auth/${options.path ?? "sign-in/social"}`, {
      method: "POST", headers: { origin: config.baseURL, "content-type": "application/json", "x-forwarded-for": ipAddress, cookie: options.cookie ?? "" },
      body: JSON.stringify({ provider: "github", callbackURL: "/admin", ...body }),
    }));
    const data = await response.clone().json();
    if (!data.url) throw new Error(`인증 시작 실패: ${response.status}`);
    const state = new URL(data.url).searchParams.get("state");
    if (!state) throw new Error("OAuth state 없음");
    states.push(state);
    return { response, state, cookie: responseCookies(response), ipAddress };
  };
  const callback = async (
    flow: Awaited<ReturnType<typeof start>>,
    handler = context.auth.handler,
    query: Record<string, string> = {},
  ) => handler(new Request(`${config.baseURL}/api/auth/callback/github?${new URLSearchParams({
    state: flow.state, code: "fixture-code", ...query,
  })}`, { headers: { cookie: flow.cookie, "x-forwarded-for": flow.ipAddress } }));

  return { ...database, context, email, clean, mockGitHub, start, callback };
}
