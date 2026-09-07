import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 | FOS Study",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-fg-primary)]">
      {children}
    </main>
  );
}
