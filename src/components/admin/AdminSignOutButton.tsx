"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminAuthClient } from "@/lib/admin/client";

export function AdminSignOutButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("로그아웃하고 있습니다.");
    try {
      const { data, error } = await adminAuthClient.signOut();
      if (error || !data?.success) throw new Error("로그아웃 실패");
      location.replace("/admin/login");
    } catch {
      setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      setPending(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="lg" disabled={pending} onClick={signOut} aria-describedby="admin-signout-status">
        {pending ? "로그아웃 중…" : "로그아웃"}
      </Button>
      <p id="admin-signout-status" role="status" aria-live="polite" className="min-h-6 text-sm text-[var(--color-fg-secondary)]">{message}</p>
    </div>
  );
}
