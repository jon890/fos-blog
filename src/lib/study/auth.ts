import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { getAdminSession, type AdminSessionResult } from "@/lib/admin/session";

export type StudyPrincipal =
  | { kind: "service" }
  | { kind: "admin"; ownerKey: string };

export type StudyAccess = "service" | "admin-read" | "admin-write" | "service-or-admin";

export function studyOwnerKey(principal: StudyPrincipal): string {
  if (principal.kind === "admin") return principal.ownerKey;
  throw new StudyAuthError(403, "FORBIDDEN", "관리자 주체가 필요한 요청입니다.");
}

export class StudyAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "StudyAuthError";
  }
}

type StudyAuthDependencies = {
  serviceToken?: string;
  siteOrigin?: string;
  getSession?: (headers: Headers) => Promise<AdminSessionResult>;
};

function tokenMatches(provided: string, configured: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(providedHash, configuredHash);
}

function configuredServiceToken(value: string | undefined): string | null {
  if (!value || Buffer.byteLength(value, "utf8") < 32) return null;
  return value;
}

export async function authorizeStudyRequest(
  request: Request,
  access: StudyAccess,
  dependencies: StudyAuthDependencies = {},
): Promise<StudyPrincipal> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const configured = configuredServiceToken(dependencies.serviceToken ?? env.STUDY_SERVICE_TOKEN);
    if (!configured || !token || !tokenMatches(token, configured)) {
      throw new StudyAuthError(401, "UNAUTHENTICATED", "서비스 인증에 실패했습니다.");
    }
    if (access !== "service" && access !== "service-or-admin") {
      throw new StudyAuthError(403, "FORBIDDEN", "서비스 주체가 사용할 수 없는 요청입니다.");
    }
    return { kind: "service" };
  }

  const session = await (dependencies.getSession ?? getAdminSession)(request.headers);
  if (session.status === "unauthenticated") {
    throw new StudyAuthError(
      401,
      "UNAUTHENTICATED",
      access === "service" ? "서비스 인증이 필요합니다." : "관리자 인증이 필요합니다.",
    );
  }
  if (session.status === "forbidden") {
    throw new StudyAuthError(403, "FORBIDDEN", "관리자 권한이 없습니다.");
  }
  if (session.status === "unavailable") {
    throw new StudyAuthError(503, "UNAVAILABLE", "관리자 세션을 확인하지 못했습니다.");
  }

  if (access === "service") {
    throw new StudyAuthError(403, "FORBIDDEN", "관리자 세션이 사용할 수 없는 요청입니다.");
  }

  if (access === "admin-write") {
    const configuredOrigin = dependencies.siteOrigin ?? env.BETTER_AUTH_URL;
    let expectedOrigin: string | null = null;
    try {
      expectedOrigin = configuredOrigin ? new URL(configuredOrigin).origin : null;
    } catch {
      expectedOrigin = null;
    }
    if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin) {
      throw new StudyAuthError(403, "FORBIDDEN", "요청 출처를 확인하지 못했습니다.");
    }
  }

  return { kind: "admin", ownerKey: "owner" };
}
