#!/usr/bin/env python3
"""
Noto Sans KR Bold를 OG 이미지용으로 subset.
- 대상: Unicode Hangul Syllables 블록 전체 (U+AC00-D7A3, 11,172자) + Basic Latin (U+0020-U+007E) + 일반 구두점
- 결과:
    public/fonts/NotoSansKR-Bold-subset.ttf    (next/og ImageResponse용 — woff2 미지원)

의존성: pip install fonttools
"""
import json
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

UNICODE_RANGE = "U+0020-007E,U+AC00-D7A3,U+2010-2026,U+3000-303F,U+FF00-FFEF"
OUTPUT_TTF = Path("public/fonts/NotoSansKR-Bold-subset.ttf")
RELEASES_API = "https://api.github.com/repos/notofonts/noto-cjk/releases"
KNOWN_FONT_URL = "https://github.com/notofonts/noto-cjk/releases/download/Sans2.004/06_NotoSansCJKkr.zip"
MAX_SIZE_BYTES = 2097152  # 2MB


def main() -> None:
    OUTPUT_TTF.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        font_path = download_font(tmpdir)
        subset_font(font_path, OUTPUT_TTF, flavor=None)

    size = OUTPUT_TTF.stat().st_size
    print(f"subset size (ttf): {size}")

    if size > MAX_SIZE_BYTES:
        print(f"ERROR: file size {size} exceeds limit {MAX_SIZE_BYTES}", file=sys.stderr)
        sys.exit(1)


def find_kr_font_url() -> tuple[str, str]:
    req = urllib.request.Request(
        RELEASES_API + "?per_page=5",
        headers={"User-Agent": "build-og-fonts-script/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        releases = json.loads(resp.read())

    for release in releases:
        for asset in release.get("assets", []):
            name: str = asset["name"]
            if ("NotoSansCJKkr" in name or ("kr" in name.lower() and "Sans" in name)) and name.endswith(".zip"):
                return asset["browser_download_url"], name

    return KNOWN_FONT_URL, "06_NotoSansCJKkr.zip"


def download_font(tmpdir: str) -> Path:
    print("Downloading font from noto-cjk releases...", file=sys.stderr)

    try:
        url, filename = find_kr_font_url()
    except Exception as e:
        print(f"GitHub API lookup failed ({e}), using known URL", file=sys.stderr)
        url, filename = KNOWN_FONT_URL, "06_NotoSansCJKkr.zip"

    dest = Path(tmpdir) / filename
    print(f"Fetching: {url}", file=sys.stderr)
    urllib.request.urlretrieve(url, dest)

    if filename.endswith(".zip"):
        return extract_bold_otf(dest, tmpdir)
    return dest


def extract_bold_otf(zip_path: Path, tmpdir: str) -> Path:
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        target = next(
            (n for n in names if "Bold" in n and (n.endswith(".otf") or n.endswith(".ttf"))),
            None,
        )
        if target is None:
            target = next((n for n in names if n.endswith(".otf") or n.endswith(".ttf")), None)
        if target is None:
            raise RuntimeError(f"No OTF/TTF found in zip. Contents: {names[:10]}")

        print(f"Extracting: {target}", file=sys.stderr)
        zf.extract(target, tmpdir)
        return Path(tmpdir) / target


def subset_font(font_path: Path, output_path: Path, flavor: str | None = "woff2") -> None:
    from fontTools.subset import main as pyftsubset  # type: ignore[import-untyped]

    args = [
        str(font_path),
        f"--unicodes={UNICODE_RANGE}",
        f"--output-file={output_path}",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
    ]
    if flavor:
        args.append(f"--flavor={flavor}")
    print(f"Running pyftsubset ({flavor or 'ttf'}) with unicode range: {UNICODE_RANGE}", file=sys.stderr)
    pyftsubset(args)


if __name__ == "__main__":
    main()
