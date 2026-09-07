"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-lg space-y-6 px-6 py-12" aria-labelledby="admin-error-title">
      <h1 id="admin-error-title" className="text-2xl font-semibold">관리자 화면을 열지 못했습니다</h1>
      <p role="alert" aria-live="assertive">관리자 인증 설정이나 세션 저장소를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" size="lg" onClick={reset}>다시 시도</Button>
        <a href="/admin/login" className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">로그인으로 이동</a>
      </div>
    </section>
  );
}
