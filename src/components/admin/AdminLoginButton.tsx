"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminAuthClient } from "@/lib/admin/client";

export function AdminLoginButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  async function signIn() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("GitHub 로그인 화면으로 이동하고 있습니다.");
    try {
      const { data, error } = await adminAuthClient.signIn.social({
        provider: "github", callbackURL: "/admin", errorCallbackURL: "/admin/login", disableRedirect: true,
      });
      if (error || !data?.url) throw new Error("로그인 시작 실패");
      const destination = new URL(data.url);
      if (destination.origin !== "https://github.com" || destination.pathname !== "/login/oauth/authorize") {
        throw new Error("로그인 주소 확인 실패");
      }
      // 서버가 disableRedirect를 고정하므로 Better Auth의 자동 이동은 실행되지 않는다.
      location.assign(destination.href);
    } catch {
      setMessage("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="lg" disabled={disabled || pending} onClick={signIn} aria-describedby="admin-login-status">
        {pending ? "로그인 연결 중…" : "GitHub으로 로그인"}
      </Button>
      <p id="admin-login-status" role="status" aria-live="polite" className="min-h-6 text-sm text-[var(--color-fg-secondary)]">{message}</p>
    </div>
  );
}
