import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authAccount } from "@/infra/db/schema/auth";
import logger from "@/lib/logger";
import { AdminAuthConfigurationError, getAdminAuthContext, type AdminAuthContext } from "./auth";

const log = logger.child({ module: "admin/session" });

export type AdminSession = {
  user: { id: string; name: string };
  session: { id: string; expiresAt: Date };
};
export type AdminSessionResult =
  | { status: "authenticated"; data: AdminSession }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable"; reason: "configuration" | "database" };

export async function getAdminSession(
  requestHeaders: Headers,
  context?: AdminAuthContext,
): Promise<AdminSessionResult> {
  try {
    const { auth, db, config } = context ?? getAdminAuthContext();
    // getSessionFromCtx는 DB 오류를 null로 바꾸므로 직접 API를 호출한다.
    const result = await auth.api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
    if (!result) return { status: "unauthenticated" };
    const accounts = await db.select({ accountId: authAccount.accountId }).from(authAccount)
      .where(and(eq(authAccount.userId, result.user.id), eq(authAccount.providerId, "github")));
    if (accounts.length !== 1 || accounts[0].accountId !== config.githubUserId) return { status: "forbidden" };
    return {
      status: "authenticated",
      data: {
        user: { id: result.user.id, name: result.user.name },
        session: { id: result.session.id, expiresAt: result.session.expiresAt },
      },
    };
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) return { status: "unavailable", reason: "configuration" };
    log.error("관리자 세션 조회 실패");
    return { status: "unavailable", reason: "database" };
  }
}

export async function requireAdminPage(): Promise<AdminSession> {
  const result = await getAdminSession(await headers());
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "forbidden") redirect("/admin/login?error=admin_account_not_allowed");
  if (result.status === "unavailable") {
    if (result.reason === "configuration") throw new AdminAuthConfigurationError();
    throw new Error("관리자 세션을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return result.data;
}
