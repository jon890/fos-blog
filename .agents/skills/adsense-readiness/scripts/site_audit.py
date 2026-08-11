#!/usr/bin/env python3
"""배포된 사이트를 AdSense 심사 관점에서 점검한다.

세 축을 다룬다.
  축 4 필수 페이지  — 개인정보처리방침·소개·연락처
  축 5 크롤 가능성  — robots.txt, sitemap.xml, 응답 코드
  축 6 도메인·소유권 — 신청 도메인이 실제로 콘텐츠를 서빙하는가, ads.txt

축 6 이 중요한 이유는 AdSense 가 루트 도메인 단위로만 신청을 받기 때문이다.
콘텐츠가 서브도메인에 있고 루트가 리디렉션만 하면,
심사 봇이 처음 보는 것은 콘텐츠가 아니라 리디렉션 응답이다.

표준 라이브러리만 쓴다. 설치 없이 어디서든 돌아가야 하기 때문이다.

사용법:
  site_audit.py --domain blog.example.com
                [--apply-domain example.com]   # AdSense 에 신청한 도메인
                [--pages /privacy,/about,/contact]
                [--json]
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (compatible; adsense-readiness/1.0)"
TIMEOUT = 20


def normalize_host(value):
    """도메인 인자에서 스킴과 경로를 벗겨 host 만 남긴다.

    사용자가 `--domain https://example.com` 처럼 넣는 일이 잦다.
    그대로 이어 붙이면 "https://https://example.com" 이 되어 모든 요청이 실패하고,
    그 실패가 입력 오류가 아니라 사이트 결함으로 보고된다.
    """
    v = value.strip()
    v = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", "", v)
    return v.split("/", 1)[0].strip("/")


def fetch(url, method="GET", follow=False):
    """(status, final_url, body, error) 를 반환한다. 리디렉션은 기본적으로 따라가지 않는다."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, resp.geturl(), body, None
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location") if e.headers else None
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        return e.code, loc or url, body, None
    except Exception as e:  # DNS 실패, 타임아웃 등
        return None, url, "", str(e)


TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
HTML_RE = re.compile(r"<[^>]+>")


def visible_text_len(html):
    """스크립트와 태그를 걷어낸 본문 길이. 얇은 페이지 판정에 쓴다."""
    t = TAG_RE.sub(" ", html)
    t = HTML_RE.sub(" ", t)
    return len(re.sub(r"\s+", "", t))


def redirect_chain(url, max_hops=5):
    """리디렉션을 한 단계씩 따라가며 경로를 기록한다."""
    chain = []
    current = url
    for _ in range(max_hops):
        status, final, body, err = fetch(current)
        if err:
            chain.append({"url": current, "status": None, "error": err})
            return chain
        chain.append({"url": current, "status": status})
        if status in (301, 302, 303, 307, 308) and final and final != current:
            current = final
            continue
        return chain
    return chain


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True,
                    help="콘텐츠가 실제로 서빙되는 도메인. https:// 는 붙여도 되고 안 붙여도 된다")
    ap.add_argument("--apply-domain",
                    help="AdSense 에 신청한 도메인. 다르면 리디렉션을 점검한다")
    ap.add_argument("--pages", default="/privacy,/about,/contact",
                    help="필수 페이지 경로. 쉼표 구분")
    ap.add_argument("--min-page-chars", type=int, default=300,
                    help="필수 페이지가 이 길이 미만이면 형식만 갖춘 것으로 본다")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    # 스킴을 붙여 넣어도 동작해야 한다.
    # 그냥 이어 붙이면 "https://https://..." 가 되고, 이름 해석에 실패한 결과가
    # 입력 오류가 아니라 사이트 결함(CRITICAL 7건)으로 보고된다.
    args.domain = normalize_host(args.domain)
    if args.apply_domain:
        args.apply_domain = normalize_host(args.apply_domain)

    base = f"https://{args.domain}"
    findings = []
    result = {"domain": args.domain, "checks": {}}

    # 축 5 — 콘텐츠 도메인이 정상 응답하는가
    status, _, body, err = fetch(base, follow=True)
    result["checks"]["content_root"] = {"status": status, "error": err}
    if err or status != 200:
        findings.append(("critical", f"콘텐츠 도메인 {base} 이 200 을 반환하지 않는다 (status={status}, error={err})"))

    # 축 5 — robots.txt 와 sitemap.xml
    for name in ("robots.txt", "sitemap.xml"):
        st, _, b, e = fetch(f"{base}/{name}", follow=True)
        result["checks"][name] = {"status": st, "error": e, "bytes": len(b)}
        if e or st != 200:
            findings.append(("critical", f"{name} 을 가져올 수 없다 (status={st})"))
        elif name == "robots.txt":
            if re.search(r"^\s*Disallow:\s*/\s*$", b, re.M | re.I):
                findings.append(("critical", "robots.txt 가 사이트 전체를 차단한다 (Disallow: /)"))
            if not re.search(r"^\s*Sitemap:", b, re.M | re.I):
                findings.append(("warning", "robots.txt 에 Sitemap 선언이 없다"))

    # 축 4 — 필수 페이지가 있고 실질 내용을 담는가
    pages = {}
    for path in [p.strip() for p in args.pages.split(",") if p.strip()]:
        st, _, b, e = fetch(base + path, follow=True)
        chars = visible_text_len(b) if st == 200 else 0
        pages[path] = {"status": st, "text_chars": chars, "error": e}
        if st != 200:
            findings.append(("critical", f"필수 페이지 {path} 가 200 이 아니다 (status={st})"))
        elif chars < args.min_page_chars:
            findings.append(("warning", f"{path} 의 본문이 {chars}자로 짧다. 형식만 갖춘 페이지로 보일 수 있다"))
    result["checks"]["required_pages"] = pages

    # 축 6 — 신청 도메인이 실제로 콘텐츠를 보여주는가
    if args.apply_domain and args.apply_domain != args.domain:
        apply_base = f"https://{args.apply_domain.strip('/')}"
        chain = redirect_chain(apply_base)
        result["checks"]["apply_domain_chain"] = chain
        last = chain[-1] if chain else {}
        if last.get("error"):
            findings.append(("critical", f"신청 도메인 {apply_base} 에 접근할 수 없다: {last['error']}"))
        elif len(chain) > 1 or (chain and chain[0]["status"] in (301, 302, 307, 308)):
            findings.append((
                "warning",
                f"신청 도메인 {apply_base} 가 리디렉션만 반환한다. "
                "콘솔의 소유권 확인이 통과 상태라면 봇은 콘텐츠에 도달하고 있으므로 "
                "이 항목을 거절 원인으로 단정하지 않는다",
            ))

        # www 변형이 응답하는가. AdSense 는 www 를 함께 확인하는 경우가 있다.
        www = f"https://www.{args.apply_domain.strip('/')}"
        st, _, _, e = fetch(www)
        result["checks"]["www_variant"] = {"status": st, "error": e}
        if e:
            findings.append(("warning", f"{www} 이 응답하지 않는다 ({e})"))

    # 축 6 — ads.txt 는 신청 도메인 루트에 있어야 한다
    ads_host = args.apply_domain or args.domain
    st, _, b, e = fetch(f"https://{ads_host}/ads.txt", follow=True)
    ok = st == 200 and "google.com" in b and "pub-" in b
    result["checks"]["ads_txt"] = {"host": ads_host, "status": st, "valid": ok}
    if not ok:
        findings.append(("critical", f"https://{ads_host}/ads.txt 가 없거나 google.com pub-ID 항목을 담지 않는다"))

    result["findings"] = [{"severity": s, "message": m} for s, m in findings]

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"콘텐츠 도메인: {base}")
    if args.apply_domain:
        print(f"신청 도메인:   https://{args.apply_domain}")
    print()
    if not findings:
        print("발견 없음. 이 축들은 통과 조건을 만족한다.")
    for sev, msg in findings:
        print(f"[{sev.upper()}] {msg}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
