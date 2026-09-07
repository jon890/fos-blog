import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginButton } from "@/components/admin/AdminLoginButton";
import { getAdminSession } from "@/lib/admin/session";

const errorMessages = {
  access_denied: "GitHub 로그인을 취소했습니다. 다시 로그인할 수 있습니다.",
  admin_account_not_allowed: "관리자 권한이 없는 계정입니다. 허용된 GitHub 계정으로 로그인해 주세요.",
  authentication_failed: "GitHub 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export default async function AdminLoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [session, params] = await Promise.all([getAdminSession(await headers()), searchParams]);
  if (session.status === "authenticated") redirect("/admin");

  const unavailable = session.status === "unavailable";
  const code = session.status === "forbidden" ? "admin_account_not_allowed" : params.error;
  const message = unavailable
    ? session.reason === "configuration"
      ? "관리자 인증 설정이 필요합니다. 설정을 마친 뒤 다시 접속해 주세요."
      : "관리자 세션을 확인하지 못했습니다. 잠시 후 새로고침해 주세요."
    : typeof code === "string"
      ? Object.hasOwn(errorMessages, code) ? errorMessages[code as keyof typeof errorMessages] : errorMessages.authentication_failed
      : code ? errorMessages.authentication_failed : null;

  return (
    <section aria-labelledby="admin-login-title" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-fg-secondary)]">FOS Study</p>
        <h1 id="admin-login-title" className="text-3xl font-semibold">관리자 로그인</h1>
        <p className="text-[var(--color-fg-secondary)]">허용된 본인 GitHub 계정으로 로그인해 주세요.</p>
      </div>
      {message ? <p role="status" aria-live="polite" className="rounded-lg border border-[var(--color-border-default)] p-4 text-sm">{message}</p> : null}
      <AdminLoginButton disabled={unavailable} />
      {unavailable ? <a href="/admin/login" className="w-fit rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">다시 확인</a> : null}
    </section>
  );
}
