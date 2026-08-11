#!/usr/bin/env python3
"""마크다운 콘텐츠를 AdSense 심사 관점에서 측정한다.

두 축을 다룬다.
  축 1 콘텐츠 충실도 — 산문 분량과 코드 비중
  축 3 독창성       — 직접 해본 흔적의 대리 지표

frontmatter 의 작성일·저자도 함께 세지만 이것으로 축 7(E-E-A-T)을 판정하지 않는다.
원본에 없어도 사이트가 DB나 커밋 이력으로 노출하고 있을 수 있어,
원본만 보고 판정하면 멀쩡한 사이트를 결함으로 오진한다.
축 7 은 `metadata_audit.py` 가 렌더된 페이지로 잰다.

독창성을 LLM 으로 직접 채점하지 않고 대리 지표로 후보를 좁히는 이유는
LLM 채점이 실행마다 흔들려 개선 loop 가 수렴하지 않고,
판정자를 만족시키는 방향으로 글이 최적화되는 실패가 생기기 때문이다.
여기서 걸러낸 소수 후보만 사람이나 LLM 이 판정하면 비용과 신뢰도가 함께 좋아진다.

사용법:
  content_audit.py --root <디렉터리> [--exclude-names README.md,AGENTS.md]
                   [--min-prose 600] [--json]
"""
import argparse
import json
import re
import sys
from pathlib import Path

# 직접 해본 흔적. 재서술 글에는 잘 나오지 않는 표현들이다.
EXPERIENCE_PATTERNS = [
    r"해\s?봤", r"돌려\s?봤", r"붙여\s?봤", r"써\s?봤", r"확인했", r"실측",
    r"직접\s", r"걸렸다", r"막혔", r"실패했", r"재현", r"장애", r"디버깅",
    r"삽질", r"운영에서", r"사내", r"우리\s?(팀|서비스|프로젝트)",
    r"\bI\s+(tried|ran|found|hit|debugged)\b",
]
# 검증 가능한 구체 증거. 수치·버전·에러는 원본 없이 지어내기 어렵다.
EVIDENCE_PATTERNS = [
    r"\d+\s?(ms|초|분|시간|MB|GB|KB|배|%|건|개|req/s|QPS|TPS|rps)",
    r"\bv?\d+\.\d+\.\d+\b",
    r"(Error|Exception|error:|Traceback|panic:)",
]

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)
CODEFENCE_RE = re.compile(r"```.*?```", re.S)


def read_body(path: Path):
    """frontmatter 를 분리해 (메타 원문, 본문) 을 반환한다."""
    text = path.read_text(encoding="utf-8", errors="replace")
    m = FRONTMATTER_RE.match(text)
    meta = m.group(1) if m else ""
    body = text[m.end():] if m else text
    return meta, body


def measure(path: Path):
    meta, body = read_body(path)
    code_chars = sum(len(m) for m in CODEFENCE_RE.findall(body))
    prose = CODEFENCE_RE.sub("", body)
    prose_chars = len(re.sub(r"\s+", "", prose))
    exp = sum(1 for p in EXPERIENCE_PATTERNS if re.search(p, prose))
    evid = sum(1 for p in EVIDENCE_PATTERNS if re.search(p, prose))
    return {
        "path": str(path),
        "prose_chars": prose_chars,
        "code_chars": code_chars,
        "experience_signals": exp,
        "evidence_signals": evid,
        "has_date": bool(re.search(r"^(date|created|published)\s*:", meta, re.M | re.I)),
        "has_author": bool(re.search(r"^(author|writer)\s*:", meta, re.M | re.I)),
    }


def percentile(values, p):
    if not values:
        return 0
    idx = min(int(len(values) * p), len(values) - 1)
    return values[idx]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="마크다운 루트 디렉터리")
    ap.add_argument("--exclude-names", default="README.md",
                    help="파일명 기준 제외 목록. 쉼표 구분. 대소문자 무시")
    ap.add_argument("--min-prose", type=int, default=600,
                    help="이 글자 수 미만이면 얇은 글로 센다")
    ap.add_argument("--json", action="store_true", help="JSON 으로 출력")
    args = ap.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        print(f"디렉터리를 찾을 수 없다: {root}", file=sys.stderr)
        return 2

    excluded = {n.strip().upper() for n in args.exclude_names.split(",") if n.strip()}
    docs = []
    for p in sorted(root.rglob("*.md")):
        rel = p.relative_to(root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if "node_modules" in rel.parts:
            continue
        if p.name.upper() in excluded:
            continue
        docs.append(measure(p))

    if not docs:
        print("측정할 마크다운이 없다.", file=sys.stderr)
        return 1

    lengths = sorted(d["prose_chars"] for d in docs)
    n = len(docs)
    total_prose = sum(lengths)
    total_code = sum(d["code_chars"] for d in docs)

    thin = [d for d in docs if d["prose_chars"] < args.min_prose]
    # 경험 신호도 증거 신호도 없는 글. 재서술일 가능성이 높아 판정 대상이 된다.
    weak = [d for d in docs if d["experience_signals"] == 0 and d["evidence_signals"] == 0]

    result = {
        "total_docs": n,
        "prose_chars": {
            "min": lengths[0],
            "p25": percentile(lengths, 0.25),
            "median": percentile(lengths, 0.5),
            "p75": percentile(lengths, 0.75),
            "max": lengths[-1],
        },
        "code_ratio_pct": round(total_code * 100 / (total_code + total_prose), 1) if (total_code + total_prose) else 0,
        "thin_docs": {"threshold": args.min_prose, "count": len(thin),
                      "pct": round(len(thin) * 100 / n, 1),
                      "paths": [d["path"] for d in thin]},
        "originality_proxy": {
            "with_experience": sum(1 for d in docs if d["experience_signals"]),
            "with_evidence": sum(1 for d in docs if d["evidence_signals"]),
            "with_both": sum(1 for d in docs if d["experience_signals"] and d["evidence_signals"]),
            "judgment_candidates": {"count": len(weak),
                                    "pct": round(len(weak) * 100 / n, 1),
                                    "paths": [d["path"] for d in weak]},
        },
        "metadata": {
            "with_date": sum(1 for d in docs if d["has_date"]),
            "with_author": sum(1 for d in docs if d["has_author"]),
        },
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    r = result
    print(f"문서 {n}개")
    pc = r["prose_chars"]
    print(f"  산문 글자수  최소 {pc['min']} / 25% {pc['p25']} / 중앙값 {pc['median']} / 75% {pc['p75']} / 최대 {pc['max']}")
    print(f"  코드 비중    {r['code_ratio_pct']}%")
    td = r["thin_docs"]
    print(f"  {td['threshold']}자 미만  {td['count']}개 ({td['pct']}%)")
    op = r["originality_proxy"]
    print(f"  경험 신호 포함 {op['with_experience']}개 / 증거 신호 포함 {op['with_evidence']}개 / 둘 다 {op['with_both']}개")
    jc = op["judgment_candidates"]
    print(f"  판정 후보(신호 없음)  {jc['count']}개 ({jc['pct']}%)")
    for p in jc["paths"][:15]:
        print(f"    {p}")
    if len(jc["paths"]) > 15:
        print(f"    ... 외 {len(jc['paths']) - 15}개")
    md = r["metadata"]
    print(f"  원본 frontmatter — 작성일 {md['with_date']}개 / 저자 {md['with_author']}개")
    print("    이 값으로 축 7(E-E-A-T)을 판정하지 않는다."
          " 원본에 없어도 사이트가 DB·커밋 이력으로 노출할 수 있다.")
    print("    판정은 metadata_audit.py 로 렌더된 페이지를 본다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
