import type { Metadata } from "next";
import { env } from "@/env";

export const revalidate = 86400;

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "FOS Study 블로그의 개인정보처리방침을 안내합니다.",
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "개인정보처리방침 | FOS Study",
    description: "FOS Study 블로그의 개인정보처리방침을 안내합니다.",
    url: `${siteUrl}/privacy`,
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <article className="prose prose-gray dark:prose-invert max-w-3xl mx-auto">
        <h1>개인정보처리방침</h1>

        <h2>1. 수집하는 정보</h2>
        <p>FOS Study 블로그는 아래의 정보를 수집합니다.</p>
        <ul>
          <li>
            <strong>방문 통계:</strong> IP 주소의 SHA-256 해시값을 수집합니다.
            해시는 원본 IP 주소로 복원할 수 없으며, 하루 단위 중복 방문 판별
            목적으로만 사용됩니다.
          </li>
          <li>
            <strong>댓글:</strong> 닉네임(공개), 비밀번호(bcrypt 해시 저장 —
            원본 복원 불가), 댓글 본문을 수집합니다. 댓글 작성 시 IP 주소는
            수집하지 않습니다.
          </li>
          <li>
            <strong>쿠키 / 로컬스토리지:</strong> 테마(light/dark) 설정을
            브라우저 로컬스토리지에 저장합니다.
          </li>
        </ul>

        <h2>2. 이용 목적</h2>
        <ul>
          <li>방문자 통계 집계 (방문자 추이 파악)</li>
          <li>댓글 작성자 본인 확인 (비밀번호로 댓글 수정·삭제)</li>
          <li>사용자 환경 맞춤 (테마 설정 유지)</li>
        </ul>

        <h2>3. 제3자 제공</h2>
        <p>
          본 블로그는 Google AdSense를 통해 광고를 제공합니다. Google은 광고
          개인화 목적으로 쿠키를 사용할 수 있으며, 해당 쿠키는 Google이
          관리합니다. Google의 데이터 사용 방식에 대한 자세한 내용은{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google 파트너 사이트 정책
          </a>
          을 참고하세요.
        </p>
        <p>현재 Google Analytics는 사용하지 않습니다.</p>

        <h2>4. 보관 기간</h2>
        <ul>
          <li>
            <strong>방문 로그:</strong> SHA-256 해시 기반이라 개인 식별이
            불가능하므로 무기한 보관합니다.
          </li>
          <li>
            <strong>댓글:</strong> 게시자가 비밀번호를 통해 직접 삭제할 수
            있습니다. 삭제 요청이 없는 경우 무기한 보관합니다.
          </li>
          <li>
            <strong>테마 설정:</strong> 브라우저 로컬스토리지에 저장되며,
            브라우저 데이터 삭제 시 함께 삭제됩니다.
          </li>
        </ul>

        <h2>5. 문의</h2>
        <p>
          개인정보 관련 문의는{" "}
          <a href="/contact">연락처 페이지</a>를 통해 주세요.
        </p>

        <h2>6. 개정 이력</h2>
        <ul>
          <li>2026-04-24: 최초 게시</li>
        </ul>
      </article>
    </div>
  );
}
