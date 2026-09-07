import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase, getTestDatabaseUrl } from "@/infra/db/test-utils";
import { authAccount, authSession, authUser } from "@/infra/db/schema/auth";
import { createAdminAuth, getAdminAuthContext, getAdminCallbackURL, AdminAuthConfigurationError } from "@/lib/admin/auth";
import { createAuthFixture, responseCookies } from "@/lib/admin/test-utils";
import { GET, POST, DELETE, PATCH, PUT, HEAD, OPTIONS } from "./route";

vi.mock("@/lib/admin/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/admin/auth")>(), getAdminAuthContext: vi.fn(),
}));
const logCalls = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { child: () => logCalls } }));

const origin = "https://admin.example.test";
const request = (path: string, method = "GET", headers: Record<string, string> = {}, body?: unknown) =>
  new Request(`${origin}/api/auth/${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

describe("인증 HTTP 입력 제한", () => {
  afterEach(() => vi.mocked(getAdminAuthContext).mockReset());
  it.each(["https://evil.test/admin", "//evil.test/admin", "/administrator", "/admin/login", "/admin/login?returnTo=/admin", "/admin/../public", "/admin/%2e%2e/public", "/admin\\..\\public"])("허용하지 않은 복귀를 /admin으로 대체: %s", (value) => {
    expect(getAdminCallbackURL(value, origin)).toBe("/admin");
  });
  it.each(["/admin", "/admin/study?q=hello", `${origin}/admin/study`])("같은 origin의 관리자 경로 허용: %s", (value) => {
    expect(getAdminCallbackURL(value, origin)).toBe(value.replace(origin, ""));
  });
  it("설정 부재는 503이고 개인 응답을 캐시하거나 색인하지 않는다", async () => {
    vi.mocked(getAdminAuthContext).mockImplementation(() => { throw new AdminAuthConfigurationError(); });
    const response = await GET(request("get-session"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.text()).toContain("관리자 인증 설정이 필요합니다");
  });
  it("비밀번호·계정변경·계정연결과 허용하지 않은 메서드를 404로 막는다", async () => {
    for (const path of ["sign-in/email", "sign-up/email", "link-social", "update-user", "delete-user", "change-email", "list-sessions", "token"]) {
      expect((await POST(request(path, "POST"))).status).toBe(404);
    }
    expect((await GET(request("sign-out"))).status).toBe(404);
    expect((await POST(request("callback/github", "POST"))).status).toBe(404);
    expect((await POST(request("get-session", "POST"))).status).toBe(404);
    for (const [method, handler] of [["DELETE", DELETE], ["PATCH", PATCH], ["PUT", PUT], ["HEAD", HEAD], ["OPTIONS", OPTIONS]] as const) {
      expect((await handler(request("get-session", method))).status).toBe(404);
    }
  });
});

describe.skipIf(!getTestDatabaseUrl())("인증 Route 실제 OAuth·MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
  beforeAll(async () => { fixture = await createAuthFixture("route"); });
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.mockGitHub();
    vi.mocked(getAdminAuthContext).mockReturnValue(fixture.context);
  });
  afterEach(async () => { await fixture.clean(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  afterAll(async () => { await fixture.connection.end(); });
  const login = async () => fixture.callback(await fixture.start(POST), GET);

  it("동일 IP의 반복 로그인은 라이브러리 rate limit 429를 유지한다", async () => {
    const options = { ipAddress: "198.51.100.63" };
    for (let i = 0; i < 3; i++) await fixture.start(POST, {}, options);
    const response = await POST(request("sign-in/social", "POST", {
      origin, "content-type": "application/json", "x-forwarded-for": options.ipAddress,
    }, { provider: "github" }));
    expect(response.status).toBe(429);
  });

  it("최초 로그인·재로그인과 축소 세션 응답", async () => {
    const first = await login();
    expect(first.headers.get("location")).toBe(`${origin}/admin`);
    const second = await login();
    expect(second.headers.get("location")).toBe(`${origin}/admin`);
    const response = await GET(request("get-session", "GET", { cookie: responseCookies(first) }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.name).toBe("Fixture Admin");
    expect(Object.keys(data.user).sort()).toEqual(["id", "name"]);
    expect(Object.keys(data.session).sort()).toEqual(["expiresAt", "id"]);
    expect(JSON.stringify(data)).not.toMatch(/PRIVATE_OAUTH_TOKEN|accessToken|token|email|account/);
    expect(await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email))).toHaveLength(1);
  });
  it("Origin 없음·불일치와 다른 provider는 인증 행을 만들지 않는다", async () => {
    const invalidOrigins: Record<string, string>[] = [{}, { origin: "https://evil.test" }];
    for (const headers of invalidOrigins) {
      expect((await POST(request("sign-in/social", "POST", headers, { provider: "github" }))).status).toBe(403);
      expect((await POST(request("sign-out", "POST", headers))).status).toBe(403);
    }
    expect((await POST(request("sign-in/social", "POST", { origin }, { provider: "google" }))).status).toBe(400);
    expect(await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email))).toHaveLength(0);
  });
  it.each(["https://evil.test/admin", "//evil.test/admin", "/administrator", "/admin/login"])("OAuth state에 안전한 복귀만 저장: %s", async (callbackURL) => {
    const flow = await fixture.start(POST, { callbackURL, newUserCallbackURL: "https://evil.test", errorCallbackURL: "https://evil.test" });
    expect((await fixture.callback(flow, GET)).headers.get("location")).toBe(`${origin}/admin`);
  });
  it("변조·재사용 state와 state 쿠키 부재를 거절한다", async () => {
    const flow = await fixture.start(POST);
    const tampered = await fixture.callback(flow, GET, { state: `${flow.state}tampered` });
    expect(tampered.headers.get("location")).toBe(`${origin}/admin/login?error=authentication_failed`);
    const missingCookie = await fixture.callback({ ...flow, cookie: "" }, GET);
    expect(missingCookie.headers.get("location")).toContain("error=authentication_failed");
    expect(await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email))).toHaveLength(0);
    expect((await fixture.callback(flow, GET)).headers.get("location")).toBe(`${origin}/admin`);
    expect((await fixture.callback(flow, GET)).headers.get("location")).toContain("error=authentication_failed");
  });
  it("다른 계정과 OAuth 취소·제공자 오류는 일반화하고 원문을 기록하지 않는다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fixture.mockGitHub(424243);
    expect((await login()).headers.get("location")).toBe(`${origin}/admin/login?error=admin_account_not_allowed`);
    const cancelled = await fixture.callback(await fixture.start(POST), GET, { error: "access_denied", error_description: "PRIVATE_PROVIDER_DETAIL" });
    expect(cancelled.headers.get("location")).toBe(`${origin}/admin/login?error=access_denied`);
    fixture.mockGitHub(424242, true);
    const error = await login();
    expect(error.headers.get("location")).toBe(`${origin}/admin/login?error=authentication_failed`);
    expect(await error.text()).not.toContain("PRIVATE_PROVIDER_DETAIL");
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/PRIVATE_PROVIDER_DETAIL|PRIVATE_OAUTH_TOKEN/);
    expect(logCalls.error).toHaveBeenCalled();
    expect(JSON.stringify(Object.values(logCalls).map((method) => method.mock.calls))).not.toMatch(/PRIVATE_PROVIDER_DETAIL|PRIVATE_OAUTH_TOKEN|fixture-admin|424243|mysql:/);
    expect(await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email))).toHaveLength(0);
  });
  it("로그아웃은 서버 세션 철회 후 쿠키를 지우고 이전 쿠키를 거절한다", async () => {
    const cookie = responseCookies(await login());
    const response = await POST(request("sign-out", "POST", { origin, cookie }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(await (await GET(request("get-session", "GET", { cookie }))).json()).toBeNull();
  });
  it("이메일이 같은 다른 ID도 관리자 권한 없음으로 안내한다", async () => {
    await login();
    fixture.mockGitHub(424243);
    expect((await login()).headers.get("location")).toBe(`${origin}/admin/login?error=admin_account_not_allowed`);
    const [user] = await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email));
    expect(await fixture.db.select().from(authAccount).where(eq(authAccount.userId, user.id))).toHaveLength(1);
    expect(await fixture.db.select().from(authSession).where(eq(authSession.userId, user.id))).toHaveLength(1);
  });
  it("실제 MySQL 삭제 실패는 503이며 쿠키와 세션을 유지해 재시도한다", async () => {
    const cookie = responseCookies(await login());
    await fixture.connection.query("START TRANSACTION READ ONLY");
    try {
      const response = await POST(request("sign-out", "POST", { origin, cookie }));
      expect(response.status).toBe(503);
      expect(response.headers.get("set-cookie")).toBeNull();
    } finally { await fixture.connection.query("ROLLBACK"); }
    expect((await (await GET(request("get-session", "GET", { cookie }))).json()).user.name).toBe("Fixture Admin");
    expect((await POST(request("sign-out", "POST", { origin, cookie }))).status).toBe(200);
  });
  it("account 삭제와 allowlist 변경은 HTTP 403이며 만료는 익명으로 구분한다", async () => {
    const cookie = responseCookies(await login());
    const current = await fixture.context.auth.api.getSession({ headers: new Headers({ cookie }) });
    if (!current) throw new Error("인증 세션 필요");
    vi.mocked(getAdminAuthContext).mockReturnValue({ ...fixture.context, config: { ...fixture.context.config, githubUserId: "424243" } });
    expect((await GET(request("get-session", "GET", { cookie }))).status).toBe(403);
    vi.mocked(getAdminAuthContext).mockReturnValue(fixture.context);
    await fixture.db.delete(authAccount).where(eq(authAccount.userId, current.user.id));
    expect((await GET(request("get-session", "GET", { cookie }))).status).toBe(403);
    await fixture.db.update(authSession).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authSession.id, current.session.id));
    expect(await (await GET(request("get-session", "GET", { cookie }))).json()).toBeNull();
  });
  it("실제 DB 장애는 HTTP 503이고 DB 연결 문자열을 응답하지 않는다", async () => {
    const cookie = responseCookies(await login());
    const broken = await createTestDatabase();
    const context = { ...fixture.context, db: broken.db, auth: createAdminAuth(broken.db, fixture.context.config) };
    await context.auth.$context;
    await broken.connection.end();
    vi.mocked(getAdminAuthContext).mockReturnValue(context);
    for (const [path, method, handler] of [["get-session", "GET", GET], ["sign-out", "POST", POST]] as const) {
      const response = await handler(request(path, method, { origin, cookie }));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toMatch(/mysql:|PRIVATE_|password|token/);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
