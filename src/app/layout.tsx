import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { env } from "@/env";
import { OG_WIDTH, OG_HEIGHT } from "@/lib/og";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { SidebarProvider } from "@/components/SidebarContext";
import { SiteFooter } from "@/components/SiteFooter";
import { FolderSidebarWrapper } from "@/app/components/FolderSidebarWrapper";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FOS Study - 개발 학습 블로그",
    template: "%s | FOS Study",
  },
  description:
    "개발 공부 기록을 정리하는 블로그입니다. AI, 알고리즘, 아키텍처, 데이터베이스, DevOps, Java, JavaScript, React 등 다양한 주제를 다룹니다.",
  keywords: [
    "개발",
    "프로그래밍",
    "학습",
    "블로그",
    "JavaScript",
    "TypeScript",
    "Java",
    "Spring",
    "React",
    "Next.js",
    "알고리즘",
    "자료구조",
    "DevOps",
    "데이터베이스",
  ],
  authors: [{ name: "jon890", url: "https://github.com/jon890" }],
  creator: "jon890",
  publisher: "FOS Study",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "FOS Study",
    title: "FOS Study - 개발 학습 블로그",
    description: "개발 공부 기록을 정리하는 블로그입니다.",
    images: [
      {
        url: `${siteUrl}/og-default.png`,
        width: OG_WIDTH,
        height: OG_HEIGHT,
        alt: "FOS Study — 개발 학습 블로그",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FOS Study - 개발 학습 블로그",
    description: "개발 공부 기록을 정리하는 블로그입니다.",
    images: [`${siteUrl}/og-default.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseId = env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

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
        {/* Google AdSense - 소유권 확인용 메타태그 */}
        {adsenseId && (
          <meta name="google-adsense-account" content={adsenseId} />
        )}
        {/* Google AdSense - 스크립트 */}
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SidebarProvider>
          <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            <Header />
            <FolderSidebarWrapper />
            <main>{children}</main>
            <SiteFooter />
          </div>
          </SidebarProvider>
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
