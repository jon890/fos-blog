import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { getAdminSession, type AdminSessionResult } from "@/lib/admin/session";
import logger from "@/lib/logger";

const log = logger.child({ module: "study/auth" });

export type StudyPrincipal =
  | { kind: "service" }
  | { kind: "admin"; ownerKey: string };

export type StudyAccess = "service" | "admin-read" | "admin-write" | "service-or-admin";

export const STUDY_OWNER_KEY = "owner";

export function studyOwnerKey(principal: StudyPrincipal): string {
  return principal.kind === "admin" ? principal.ownerKey : STUDY_OWNER_KEY;
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
  recordAccess?: (entry: StudyAccessRecord) => void;
};

/** 기존 endpoint 사용 여부를 판정하는 근거다. 비밀값과 요청 내용은 담지 않는다. */
export type StudyAccessRecord = {
  method: string;
  path: string;
  principal: StudyPrincipal["kind"];
};

function defaultRecordAccess(entry: StudyAccessRecord): void {
  log.info(entry, "학습자료 endpoint 접근");
}

/**
 * 14개 route 가 모두 거치는 단일 지점이다.
 * 성공한 요청의 method, 경로와 주체 종류만 남기고 token, query, 메모와 본문은 남기지 않는다.
 */
function recordStudyAccess(
  request: Request,
  principal: StudyPrincipal,
  record: ((entry: StudyAccessRecord) => void) | undefined,
): StudyPrincipal {
  let path = "";
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = "";
  }
  (record ?? defaultRecordAccess)({ method: request.method, path, principal: principal.kind });
  return principal;
}

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
    return recordStudyAccess(request, { kind: "service" }, dependencies.recordAccess);
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

  return recordStudyAccess(request, { kind: "admin", ownerKey: STUDY_OWNER_KEY }, dependencies.recordAccess);
}
