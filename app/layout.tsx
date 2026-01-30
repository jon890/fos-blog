import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FOS Study - 개발 학습 블로그",
  description:
    "개발 공부 기록을 정리하는 블로그입니다. AI, 알고리즘, 아키텍처, 데이터베이스, DevOps 등 다양한 주제를 다룹니다.",
  keywords: [
    "개발",
    "프로그래밍",
    "학습",
    "블로그",
    "JavaScript",
    "Java",
    "React",
  ],
  authors: [{ name: "jon890" }],
  openGraph: {
    title: "FOS Study - 개발 학습 블로그",
    description: "개발 공부 기록을 정리하는 블로그입니다.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
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
                <div className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    © {new Date().getFullYear()} FOS Study. Built with Next.js &
                    Tailwind CSS
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
