import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase, getTestDatabaseUrl } from "@/infra/db/test-utils";
import { authAccount, authSession } from "@/infra/db/schema/auth";
import { createAdminAuth } from "./auth";
import { getAdminSession } from "./session";
import { createAuthFixture, responseCookies } from "./test-utils";

describe.skipIf(!getTestDatabaseUrl())("매 요청 관리자 세션 실제 MySQL", () => {
  let fixture: Awaited<ReturnType<typeof createAuthFixture>>;
  let headers: Headers;
  beforeAll(async () => { fixture = await createAuthFixture("session"); });
  beforeEach(async () => {
    fixture.mockGitHub();
    const response = await fixture.callback(await fixture.start());
    headers = new Headers({ cookie: responseCookies(response) });
  });
  afterEach(async () => { await fixture.clean(); vi.unstubAllGlobals(); });
  afterAll(async () => { await fixture.connection.end(); });

  it("유효한 세션을 DB에서 읽고 민감한 필드를 제외한다", async () => {
    const result = await getAdminSession(headers, fixture.context);
    expect(result.status).toBe("authenticated");
    if (result.status !== "authenticated") throw new Error("인증 세션 필요");
    expect(Object.keys(result.data.user).sort()).toEqual(["id", "name"]);
    expect(Object.keys(result.data.session).sort()).toEqual(["expiresAt", "id"]);
    expect(await getAdminSession(new Headers({ authorization: "Bearer fixture-service-token" }), fixture.context)).toEqual({ status: "unauthenticated" });
  });
  it.each(["delete", "expire"])("세션 %s 후 같은 쿠키를 거절한다", async (action) => {
    const current = await fixture.context.auth.api.getSession({ headers });
    if (!current) throw new Error("인증 세션 필요");
    if (action === "delete") await fixture.db.delete(authSession).where(eq(authSession.id, current.session.id));
    else await fixture.db.update(authSession).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authSession.id, current.session.id));
    expect(await getAdminSession(headers, fixture.context)).toEqual({ status: "unauthenticated" });
  });
  it("account 삭제와 새 환경 ID는 기존 쿠키를 즉시 금지한다", async () => {
    const current = await fixture.context.auth.api.getSession({ headers });
    if (!current) throw new Error("인증 세션 필요");
    const config = { ...fixture.context.config, githubUserId: "424243" };
    expect(await getAdminSession(headers, { ...fixture.context, config, auth: createAdminAuth(fixture.db, config) })).toEqual({ status: "forbidden" });
    await fixture.db.delete(authAccount).where(eq(authAccount.userId, current.user.id));
    expect(await getAdminSession(headers, fixture.context)).toEqual({ status: "forbidden" });
  });
  it("활동이 7일 고정 만료를 늘리지 않으며 쿠키 캐시를 만들지 않는다", async () => {
    const current = await fixture.context.auth.api.getSession({ headers });
    if (!current) throw new Error("인증 세션 필요");
    const updatedAt = new Date(Date.now() - 172800000);
    await fixture.db.update(authSession).set({ updatedAt }).where(eq(authSession.id, current.session.id));
    const response = await fixture.context.auth.handler(new Request(`${fixture.context.config.baseURL}/api/auth/get-session`, { headers }));
    const [stored] = await fixture.db.select().from(authSession).where(eq(authSession.id, current.session.id));
    expect(stored.expiresAt).toEqual(current.session.expiresAt);
    expect(stored.updatedAt).toEqual(updatedAt);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("실제 DB 연결 종료는 익명과 구분한다", async () => {
    const broken = await createTestDatabase();
    const context = { ...fixture.context, db: broken.db, auth: createAdminAuth(broken.db, fixture.context.config) };
    await context.auth.$context;
    await broken.connection.end();
    expect(await getAdminSession(headers, context)).toEqual({ status: "unavailable", reason: "database" });
  });
});
