import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";
import { env } from "@/env";
import { ThemeProvider } from "@/components/ThemeProvider";

// 공개 metadata는 (blog)에서만 적용한다. 미등록 관리자 경로의 루트 404도 색인하지 않는다.
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 하이드레이션 전에 테마 적용 - 깜빡임 및 불일치 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.classList.add(theme);
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster
          position="bottom-center"
          theme="system"
          toastOptions={{
            classNames: {
              toast: "bg-[var(--color-bg-elevated)] text-[var(--color-fg-primary)] border border-[var(--color-border-subtle)]",
              success: "text-[var(--color-brand-400)]",
              error: "text-red-400",
            },
          }}
        />
      </body>
    </html>
  );
}
