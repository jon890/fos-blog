import type { Metadata } from "next";
import { env } from "@/env";

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "연락처",
  description: "FOS Study 블로그 운영자에게 연락하는 방법을 안내합니다.",
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "연락처 | FOS Study",
    description: "FOS Study 블로그 운영자에게 연락하는 방법을 안내합니다.",
    url: `${siteUrl}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          연락처
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          질문, 오류 제보, 주제 제안 등 언제든지 연락주세요.
        </p>

        <div className="space-y-6">
          <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              이메일
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              개인정보 관련 문의 및 기타 사항은 이메일로 연락해 주세요.
            </p>
            <a
              href="mailto:jon89071@gmail.com"
              aria-label="이메일로 연락하기: jon89071@gmail.com"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              jon89071@gmail.com
            </a>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              평일 기준 2~3일 내에 답변드립니다.
            </p>
          </div>

          <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              GitHub Issues
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              블로그 콘텐츠의 오류 제보나 주제 제안은 GitHub Issues를 이용해
              주세요.
            </p>
            <a
              href="https://github.com/jon890/fos-study/issues"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Issues 페이지 열기 (새 탭)"
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              github.com/jon890/fos-study/issues
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
