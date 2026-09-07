import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDatabaseUrl } from "@/infra/db/test-utils";
import { authAccount, authSession, authUser } from "@/infra/db/schema/auth";
import { createAdminAuth, validateAdminAuthConfig, validateAdminUserInfo } from "./auth";
import { authTestConfig, createAuthFixture, responseCookies } from "./test-utils";

describe("관리자 인증 설정과 원본 계정 검사", () => {
  it.each(["", "0", "01", "1,2", "user-name", " 424242"])("단일 numeric ID만 허용: %s", (githubUserId) => {
    expect(() => validateAdminAuthConfig({ ...authTestConfig, githubUserId })).toThrow("관리자 인증 설정");
  });
  it.each(["https://example.test/path", "https://user:pass@example.test", "http://example.test", "https://example.test?x=1"])("origin 형식 제한: %s", (baseURL) => {
    expect(() => validateAdminAuthConfig({ ...authTestConfig, baseURL })).toThrow("관리자 인증 설정");
  });
  it("비밀과 OAuth 부분 설정을 거절한다", () => {
    for (const config of [{ secret: "short" }, { githubClientId: "" }, { githubClientSecret: "" }]) {
      expect(() => validateAdminAuthConfig({ ...authTestConfig, ...config })).toThrow("관리자 인증 설정");
    }
  });
  it("loopback HTTP는 개발 환경에서만 허용한다", () => {
    expect(validateAdminAuthConfig({ ...authTestConfig, baseURL: "http://127.0.0.1:3000" }).baseURL).toBe("http://127.0.0.1:3000");
    vi.stubEnv("NODE_ENV", "production");
    try { expect(() => validateAdminAuthConfig({ ...authTestConfig, baseURL: "http://127.0.0.1:3000" })).toThrow(); }
    finally { vi.unstubAllEnvs(); }
  });
  it.each([undefined, null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "0424242", "424242 ", "424243"])("잘못된 원본 ID 거절: %s", (id) => {
    expect(validateAdminUserInfo({ action: "create-user", method: "oauth", oauth: { providerId: "github", profile: { id } } }, "424242")).toEqual({ error: "admin_account_not_allowed" });
  });
  it("본인이라도 link-account, 다른 provider와 method를 거절한다", () => {
    for (const source of [
      { action: "link-account" as const, method: "oauth", oauth: { providerId: "github", profile: { id: 424242 } } },
      { action: "create-user" as const, method: "oauth", oauth: { providerId: "google", profile: { id: 424242 } } },
      { action: "create-user" as const, method: "email-password", oauth: { providerId: "github", profile: { id: 424242 } } },
    ]) expect(validateAdminUserInfo(source, "424242")).toEqual({ error: "admin_account_not_allowed" });
  });
  it.each([424242, "424242"])("정상 원본 ID의 생성과 재로그인을 허용: %s", (id) => {
    for (const action of ["create-user", "sign-in"] as const) {
      expect(validateAdminUserInfo({ action, method: "oauth", oauth: { providerId: "github", profile: { id } } }, "424242")).toBeUndefined();
    }
  });
});

describe.skipIf(!getTestDatabaseUrl())("관리자 OAuth 실제 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
  beforeAll(async () => { fixture = await createAuthFixture("auth"); });
  beforeEach(() => { fixture.mockGitHub(); });
  afterEach(async () => { await fixture.clean(); vi.unstubAllGlobals(); });
  afterAll(async () => { await fixture.connection.end(); });

  it("최초 로그인과 기존 로그인은 한 사용자·계정을 유지하고 7일 세션을 발급한다", async () => {
    const first = await fixture.callback(await fixture.start());
    expect(first.status).toBe(302);
    expect(first.headers.get("location")).toBe("/admin");
    const cookie = responseCookies(first);
    expect(cookie).toContain("session_token=");
    expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(first.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(first.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    expect(first.headers.get("set-cookie")).not.toMatch(/Domain=/i);
    const second = await fixture.callback(await fixture.start());
    expect(second.status).toBe(302);
    const users = await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email));
    expect(users).toHaveLength(1);
    expect(users[0].id).not.toBe("424242");
    const accounts = await fixture.db.select().from(authAccount).where(eq(authAccount.userId, users[0].id));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ accountId: "424242", providerId: "github", password: null });
    const sessions = await fixture.db.select().from(authSession).where(eq(authSession.userId, users[0].id));
    expect(sessions).toHaveLength(2);
    for (const session of sessions) expect(Math.abs(session.expiresAt.getTime() - session.createdAt.getTime() - 604800000)).toBeLessThan(1000);
  });
  it.each([424243, undefined, Number.MAX_SAFE_INTEGER + 1])("다른 계정·누락·unsafe ID는 아무 인증 행도 만들지 않는다: %s", async (id) => {
    fixture.mockGitHub(id === undefined ? null : id);
    const response = await fixture.callback(await fixture.start());
    expect(response.headers.get("location")).toContain("error=");
    expect(responseCookies(response)).not.toContain("session_token=");
    expect(await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email))).toHaveLength(0);
  });
  it("같은 이메일·login의 다른 ID와 기존 계정의 allowlist 변경을 거절한다", async () => {
    await fixture.callback(await fixture.start());
    const [user] = await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email));
    fixture.mockGitHub(424243);
    expect((await fixture.callback(await fixture.start())).headers.get("location")).toContain("error=");
    fixture.mockGitHub();
    const changed = createAdminAuth(fixture.db, { ...authTestConfig, githubUserId: "424243" });
    expect((await fixture.callback(await fixture.start(changed.handler), changed.handler)).headers.get("location")).toContain("admin_account_not_allowed");
    expect(await fixture.db.select().from(authAccount).where(eq(authAccount.userId, user.id))).toHaveLength(1);
    expect(await fixture.db.select().from(authSession).where(eq(authSession.userId, user.id))).toHaveLength(1);
  });
  it("계정연결 API도 본인을 허용하지 않는다", async () => {
    const login = await fixture.callback(await fixture.start());
    const flow = await fixture.start(fixture.context.auth.handler, {}, { path: "link-social", cookie: responseCookies(login) });
    const response = await fixture.callback(flow);
    expect(response.headers.get("location")).toContain("admin_account_not_allowed");
    const [user] = await fixture.db.select().from(authUser).where(eq(authUser.email, fixture.email));
    expect(await fixture.db.select().from(authAccount).where(eq(authAccount.userId, user.id))).toHaveLength(1);
    expect(await fixture.db.select().from(authSession).where(eq(authSession.userId, user.id))).toHaveLength(1);
  });
});
