import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@/env";
import { getDb } from "@/infra/db";
import { authSchema } from "@/infra/db/schema/auth";
import logger from "@/lib/logger";

const log = logger.child({ module: "admin/auth" });
export type AdminDatabase = ReturnType<typeof getDb>;
export type AdminAuthConfig = {
  baseURL: string;
  secret: string;
  githubClientId: string;
  githubClientSecret: string;
  githubUserId: string;
};

export class AdminAuthConfigurationError extends Error {
  constructor() {
    super("관리자 인증 설정이 필요합니다.");
    this.name = "AdminAuthConfigurationError";
  }
}

export function validateAdminAuthConfig(config: AdminAuthConfig): AdminAuthConfig {
  try {
    const url = new URL(config.baseURL);
    const localHttp = process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !localHttp) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !config.secret || Buffer.byteLength(config.secret, "utf8") < 32 ||
      !config.githubClientId?.trim() || !config.githubClientSecret?.trim() ||
      !/^[1-9][0-9]*$/.test(config.githubUserId)
    ) throw new AdminAuthConfigurationError();
    return { ...config, baseURL: url.origin };
  } catch {
    throw new AdminAuthConfigurationError();
  }
}

type UserInfoValidator = NonNullable<NonNullable<BetterAuthOptions["user"]>["validateUserInfo"]>;

export function validateAdminUserInfo(
  source: Parameters<UserInfoValidator>[0]["source"],
  allowedId: string,
) {
  const id = source.oauth?.profile?.id;
  const numericId = typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? String(id)
    : typeof id === "string" && /^[1-9][0-9]*$/.test(id) ? id : null;
  if (
    source.method !== "oauth" || source.oauth?.providerId !== "github" ||
    !["create-user", "sign-in"].includes(source.action) || numericId !== allowedId
  ) return { error: "admin_account_not_allowed" };
}

export function createAdminAuth(db: AdminDatabase, input: AdminAuthConfig) {
  const config = validateAdminAuthConfig(input);
  return betterAuth({
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: drizzleAdapter(db, { provider: "mysql", schema: authSchema, transaction: true }),
    socialProviders: {
      github: { clientId: config.githubClientId, clientSecret: config.githubClientSecret },
    },
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false } },
    user: {
      validateUserInfo: ({ source }) => validateAdminUserInfo(source, config.githubUserId),
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    session: {
      expiresIn: 604800,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
    },
    rateLimit: { enabled: true },
    onAPIError: { errorURL: `${config.baseURL}/admin/login` },
    // 제공자 오류와 SQL 오류에는 프로필·토큰·연결 문자열이 포함될 수 있다.
    // 라이브러리 메시지와 인자는 넘기지 않고 고정된 진단만 기록한다.
    logger: { log: (level) => log[level]("관리자 인증 라이브러리 진단") },
  });
}

export type AdminAuthContext = {
  auth: ReturnType<typeof createAdminAuth>;
  db: AdminDatabase;
  config: AdminAuthConfig;
};

let cachedContext: AdminAuthContext | undefined;

export function getAdminAuthContext(): AdminAuthContext {
  if (cachedContext) return cachedContext;
  const config = validateAdminAuthConfig({
    baseURL: env.BETTER_AUTH_URL ?? "",
    secret: env.BETTER_AUTH_SECRET ?? "",
    githubClientId: env.GITHUB_CLIENT_ID ?? "",
    githubClientSecret: env.GITHUB_CLIENT_SECRET ?? "",
    githubUserId: env.ADMIN_GITHUB_USER_ID ?? "",
  });
  if (!env.DATABASE_URL) throw new AdminAuthConfigurationError();
  const db = getDb();
  cachedContext = { db, config, auth: createAdminAuth(db, config) };
  return cachedContext;
}

export function getAdminCallbackURL(value: unknown, baseURL: string): string {
  if (typeof value !== "string" || value.startsWith("//") || value.includes("\\")) return "/admin";
  try {
    const url = new URL(value, baseURL);
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== baseURL || url.username || url.password ||
      !(path === "/admin" || path.startsWith("/admin/")) ||
      path === "/admin/login" || path.startsWith("/admin/login/") ||
      path.includes("\\") || path.split("/").some((part) => part === ".." || part === ".")
    ) return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}
