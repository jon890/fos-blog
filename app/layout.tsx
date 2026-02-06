import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { VisitorCount } from "@/components/VisitorCount";

const inter = Inter({ subsets: ["latin"] });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://fos-blog.vercel.app";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "FOS Study - 개발 학습 블로그",
    description: "개발 공부 기록을 정리하는 블로그입니다.",
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
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
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
  const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

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
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            <Header />
            <main>{children}</main>
            <footer className="border-t border-gray-200 dark:border-gray-800 py-12 mt-16">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {/* Brand */}
                  <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-3">
                      <span>📚</span>
                      <span>FOS Study</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      개발 학습 기록을 정리하는 블로그입니다.
                    </p>
                  </div>
                  {/* Links */}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                      바로가기
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li>
                        <a
                          href="/"
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          홈
                        </a>
                      </li>
                      <li>
                        <a
                          href="/categories"
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          카테고리
                        </a>
                      </li>
                    </ul>
                  </div>
                  {/* Social */}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                      소셜
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li>
                        <a
                          href="https://github.com/jon890"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          GitHub
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://github.com/jon890/fos-study"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          Source Repository
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center space-y-3">
                  <VisitorCount />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    © 2025 FOS Study. Built with Next.js & Tailwind CSS
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
