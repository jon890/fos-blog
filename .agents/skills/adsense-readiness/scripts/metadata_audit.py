#!/usr/bin/env python3
"""렌더된 페이지에서 E-E-A-T 신호를 측정한다 (축 7).

이 스크립트가 따로 있는 이유가 중요하다.
콘텐츠 원본(마크다운 frontmatter)에 저자와 작성일이 없어도
사이트가 다른 출처(DB, 커밋 이력, 설정값)로 노출하고 있을 수 있다.
원본만 보고 "메타데이터 없음"으로 판정하면 멀쩡한 사이트를 결함으로 오진한다.

그래서 이 축은 반드시 **배포된 페이지의 렌더 결과**로 잰다.

세 곳을 본다.
  - JSON-LD 구조화 데이터의 author / datePublished / dateModified / publisher
  - 화면 텍스트에 날짜 표기가 있는지
  - 저자 이름이 화면에 있는지

사용법:
  metadata_audit.py --urls https://example.com/posts/a,https://example.com/posts/b
  metadata_audit.py --sitemap https://example.com/sitemap.xml --path-prefix /posts/ --sample 5
  [--author-name "표시될 저자 이름"] [--json]
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

from _html_text import page_text

UA = "Mozilla/5.0 (compatible; adsense-readiness/1.0)"
TIMEOUT = 25
LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.S | re.I
)
# 화면에 날짜가 보이는지. 흔한 표기를 넓게 잡는다.
DATE_RE = re.compile(
    r"\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}"          # 2026.08.11 / 2026-08-11
    r"|\d{4}년\s?\d{1,2}월\s?\d{1,2}일"
    r"|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s*\d{4}\b"
)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""


def collect_ld(html):
    """페이지의 모든 JSON-LD 객체를 평평하게 모은다. @graph 도 펼친다."""
    out = []
    for raw in LD_RE.findall(html):
        try:
            data = json.loads(raw)
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if not isinstance(it, dict):
                continue
            if "@graph" in it and isinstance(it["@graph"], list):
                out.extend(x for x in it["@graph"] if isinstance(x, dict))
            else:
                out.append(it)
    return out


def name_of(value):
    """author 는 문자열일 수도 객체일 수도 배열일 수도 있다."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("name")
    if isinstance(value, list):
        for v in value:
            n = name_of(v)
            if n:
                return n
    return None


def audit(url, author_name=None):
    status, html = get(url)
    if status != 200 or not html:
        return {"url": url, "status": status, "error": "fetch_failed"}

    lds = collect_ld(html)
    article = next(
        (d for d in lds if str(d.get("@type", "")).lower() in ("article", "blogposting")),
        None,
    )
    text = page_text(html)

    r = {
        "url": url,
        "status": status,
        "ld_types": sorted({str(d.get("@type")) for d in lds if d.get("@type")}),
        "ld_author": name_of(article.get("author")) if article else None,
        "ld_date_published": article.get("datePublished") if article else None,
        "ld_date_modified": article.get("dateModified") if article else None,
        "ld_publisher": name_of(article.get("publisher")) if article else None,
        "visible_date": bool(DATE_RE.search(text)),
    }
    who = author_name or r["ld_author"]
    r["visible_author"] = bool(who and who in text)
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", help="쉼표로 구분한 글 URL 목록")
    ap.add_argument("--sitemap", help="sitemap 에서 표본을 뽑을 때 사용")
    ap.add_argument("--path-prefix", default="/posts/",
                    help="sitemap 에서 이 접두사를 가진 URL만 표본으로 삼는다")
    ap.add_argument("--sample", type=int, default=5, help="검사할 표본 수")
    ap.add_argument("--author-name", help="화면에서 찾을 저자 표기. 생략하면 JSON-LD 값을 쓴다")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.urls:
        urls = [u.strip() for u in args.urls.split(",") if u.strip()]
    elif args.sitemap:
        st, body = get(args.sitemap)
        if st != 200:
            print(f"sitemap 을 가져오지 못했다: {args.sitemap}", file=sys.stderr)
            return 1
        all_urls = [u for u in LOC_RE.findall(body) if args.path_prefix in u]
        if not all_urls:
            print(f"접두사 {args.path_prefix} 에 맞는 URL 이 없다", file=sys.stderr)
            return 1
        # 앞에서 자르지 않고 고르게 뽑는다. 앞쪽만 보면 특정 카테고리에 쏠린다.
        step = max(1, len(all_urls) // args.sample)
        urls = all_urls[::step][: args.sample]
    else:
        print("--urls 나 --sitemap 중 하나가 필요하다", file=sys.stderr)
        return 2

    results = [audit(u, args.author_name) for u in urls]
    ok = [r for r in results if not r.get("error")]
    summary = {
        "checked": len(results),
        "fetch_failed": len(results) - len(ok),
        "with_ld_author": sum(1 for r in ok if r["ld_author"]),
        "with_ld_date_published": sum(1 for r in ok if r["ld_date_published"]),
        "with_ld_publisher": sum(1 for r in ok if r["ld_publisher"]),
        "with_visible_date": sum(1 for r in ok if r["visible_date"]),
        "with_visible_author": sum(1 for r in ok if r["visible_author"]),
    }

    if args.json:
        print(json.dumps({"summary": summary, "pages": results}, ensure_ascii=False, indent=2))
        return 0

    n = summary["checked"]
    print(f"글 {n}개 표본 검사 (실패 {summary['fetch_failed']}개)\n")
    print("JSON-LD 구조화 데이터")
    print(f"  author        {summary['with_ld_author']}/{n}")
    print(f"  datePublished {summary['with_ld_date_published']}/{n}")
    print(f"  publisher     {summary['with_ld_publisher']}/{n}")
    print("\n화면 노출")
    print(f"  작성일        {summary['with_visible_date']}/{n}")
    print(f"  저자 이름     {summary['with_visible_author']}/{n}")
    print("\n페이지별:")
    for r in results:
        if r.get("error"):
            print(f"  [실패 {r['status']}] {r['url']}")
            continue
        flags = "".join([
            "A" if r["ld_author"] else "-",
            "D" if r["ld_date_published"] else "-",
            "P" if r["ld_publisher"] else "-",
            "d" if r["visible_date"] else "-",
            "a" if r["visible_author"] else "-",
        ])
        print(f"  {flags}  {r['url']}")
    print("\n표기: 대문자는 JSON-LD (A저자 D발행일 P발행처), 소문자는 화면 (d날짜 a저자)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
