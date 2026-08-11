#!/usr/bin/env python3
"""색인 대상 페이지 중 본문이 얇은 것을 찾는다 (축 2).

이 축이 중요한 이유는 저가치 판정이 글 본문이 아니라
목록·카테고리·태그처럼 "링크만 있는 페이지" 에서 나오는 경우가 많기 때문이다.
글 하나하나는 충실해도 그런 페이지가 sitemap 에 대량으로 실려 있으면
심사 표본에 걸려 사이트 전체가 저가치로 보인다.

sitemap.xml 을 읽어 각 URL 의 렌더 후 본문 길이를 재고 임계 미만을 보고한다.
sitemap index (중첩 sitemap) 도 따라간다.

사용법:
  thin_page_audit.py --sitemap https://example.com/sitemap.xml
                     [--threshold 500] [--limit 200] [--json]
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict

from _html_text import content_len

UA = "Mozilla/5.0 (compatible; adsense-readiness/1.0)"
TIMEOUT = 20
LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""


def collect_urls(sitemap_url, seen=None):
    """sitemap 과 중첩 sitemap 을 따라가며 페이지 URL 을 모은다."""
    seen = seen if seen is not None else set()
    if sitemap_url in seen:
        return []
    seen.add(sitemap_url)
    status, body = get(sitemap_url)
    if status != 200 or not body:
        return []
    locs = LOC_RE.findall(body)
    # sitemapindex 면 자식 sitemap 을 재귀로 따라간다.
    if "<sitemapindex" in body.lower():
        urls = []
        for child in locs:
            urls.extend(collect_urls(child, seen))
        return urls
    return locs


def find_duplicate_urls(urls):
    """같은 콘텐츠를 가리키는 중복 URL 을 찾는다.

    대소문자와 끝 슬래시만 다른 URL 이 함께 색인되면 중복 콘텐츠가 된다.
    경로 세그먼트를 그대로 URL 에 쓰는 사이트에서 흔히 생긴다.
    """
    groups = defaultdict(list)
    for u in urls:
        groups[u.rstrip("/").lower()].append(u)
    return {k: v for k, v in groups.items() if len(v) > 1}


def group_of(url):
    """URL 의 첫 경로 세그먼트로 묶는다. 어느 라우트가 얇은지 한눈에 보려는 것이다."""
    m = re.match(r"https?://[^/]+/([^/?#]*)", url)
    seg = m.group(1) if m else ""
    return f"/{seg}" if seg else "/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sitemap", required=True)
    ap.add_argument("--threshold", type=int, default=500,
                    help="렌더 후 본문이 이 글자 수 미만이면 얇은 페이지로 본다")
    ap.add_argument("--limit", type=int, default=200,
                    help="검사할 최대 URL 수. 큰 사이트에서 앞에서부터 자른다")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    urls = collect_urls(args.sitemap)
    if not urls:
        print(f"sitemap 에서 URL 을 찾지 못했다: {args.sitemap}", file=sys.stderr)
        return 1

    total = len(urls)
    targets = urls[:args.limit]
    thin, failed = [], []
    by_group = defaultdict(lambda: {"count": 0, "thin": 0})

    for u in targets:
        status, html = get(u)
        if status != 200:
            failed.append({"url": u, "status": status})
            continue
        n = content_len(html)
        g = group_of(u)
        by_group[g]["count"] += 1
        if n < args.threshold:
            by_group[g]["thin"] += 1
            thin.append({"url": u, "chars": n})

    thin.sort(key=lambda d: d["chars"])
    dups = find_duplicate_urls(urls)
    result = {
        "sitemap": args.sitemap,
        "urls_in_sitemap": total,
        "urls_checked": len(targets),
        "threshold": args.threshold,
        "thin_count": len(thin),
        "thin_pages": thin,
        "unreachable": failed,
        "by_route": {g: v for g, v in sorted(by_group.items(), key=lambda kv: -kv[1]["thin"])},
        "duplicate_urls": {"group_count": len(dups),
                           "url_count": sum(len(v) for v in dups.values()),
                           "groups": list(dups.values())},
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"sitemap URL {total}개 중 {len(targets)}개 검사 (임계 {args.threshold}자)")
    print(f"얇은 페이지: {len(thin)}개")
    if failed:
        print(f"접근 실패: {len(failed)}개")
    print("\n라우트별 (얇은 수 / 검사 수):")
    for g, v in result["by_route"].items():
        mark = "  <-- 집중" if v["thin"] and v["thin"] * 2 >= v["count"] else ""
        print(f"  {g:<28} {v['thin']:>4} / {v['count']:<4}{mark}")
    print("\n가장 얇은 페이지:")
    for d in thin[:20]:
        print(f"  {d['chars']:>5}자  {d['url']}")
    if len(thin) > 20:
        print(f"  ... 외 {len(thin) - 20}개")

    du = result["duplicate_urls"]
    if du["group_count"]:
        print(f"\n중복 URL: {du['group_count']}쌍 ({du['url_count']}개 URL)")
        print("  대소문자나 끝 슬래시만 다른 URL 이 함께 색인된다. 같은 콘텐츠가 중복으로 보인다.")
        for g in du["groups"][:8]:
            print(f"    {' | '.join(g)}")
        if du["group_count"] > 8:
            print(f"    ... 외 {du['group_count'] - 8}쌍")
    return 0


if __name__ == "__main__":
    sys.exit(main())
