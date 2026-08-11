"""렌더된 HTML 에서 본문 텍스트를 뽑는 공용 로직.

두 스크립트(thin_page_audit, metadata_audit)가 함께 쓴다.
각자 구현하면 한쪽만 고쳐져 같은 페이지를 다르게 재는 일이 생긴다.

본문 추출이 생각보다 까다로운 이유가 있다.
헤더·네비게이션·푸터는 모든 페이지에 똑같이 들어가므로 함께 세면
본문이 한 줄인 페이지도 수천 자로 보인다. 그래서 본문 영역만 골라야 한다.

그런데 스트리밍 렌더를 쓰는 프레임워크는 로딩 스켈레톤을 먼저 내보낸다.
관측된 형태가 둘이다.
  - <main> 이 여러 개고 첫 번째가 스켈레톤
  - <main> 이 하나인데 그게 스켈레톤이고 실제 본문은 </main> 뒤에 붙는다

두 번째 경우 때문에 "<main> 안만 본다" 는 규칙이 통하지 않는다.
그래서 후보를 여러 개 모으고, 어느 것도 실질 내용을 담지 못하면 전체 문서로 물러선다.
"""
import re

_STRIP_RE = re.compile(r"<(script|style|noscript|template)[^>]*>.*?</\1>", re.S | re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_MAIN_RE = re.compile(r"<main[^>]*>(.*?)</main>", re.S | re.I)
_ARTICLE_RE = re.compile(r"<article[^>]*>(.*?)</article>", re.S | re.I)
_FOOTER_RE = re.compile(r"<footer[^>]*>.*?</footer>", re.S | re.I)
# 본문 후보가 이보다 짧으면 빈 스켈레톤으로 보고 전체 문서로 물러선다.
_EMPTY_SHELL_CHARS = 50
_NAV_RE = re.compile(r"<nav[^>]*>.*?</nav>", re.S | re.I)
_HEADER_RE = re.compile(r"<header[^>]*>.*?</header>", re.S | re.I)



def to_text(fragment: str) -> str:
    """태그와 스크립트를 걷어낸 평문."""
    t = _STRIP_RE.sub(" ", fragment)
    t = _TAG_RE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def content_text(html: str) -> str:
    """본문으로 볼 만한 영역의 평문을 반환한다.

    <main> 과 <article> 을 모두 후보로 보고 가장 내용이 많은 것을 고른다.
    <main> 하나만 보면 스트리밍 렌더의 로딩 스켈레톤을 재게 되는데,
    그런 페이지도 실제 본문은 <article> 안에 있어 후보를 둘로 두면 잡힌다.

    후보가 없거나, 있어도 사실상 비어 있으면 전체 문서로 물러선다.
    빈 스켈레톤만 남기고 본문을 그 밖에 렌더하는 페이지가 실제로 있다.

    폴백 기준을 높게 잡으면 안 된다.
    "후보가 짧으면 전체로 폴백" 하도록 만들면 본문이 실제로 짧은 페이지까지
    사이트 공통 요소를 세어 두껍게 측정되고, 얇은 페이지를 찾겠다는 목적이 뒤집힌다.
    임계 200자로 시험했을 때 얇은 카테고리 24개 중 8개가 그렇게 가려졌다.
    실제로 얇은 페이지도 제목과 링크로 수십 자는 나오므로, 스켈레톤만 걸러질 만큼 낮게 둔다.
    """
    candidates = _MAIN_RE.findall(html) + _ARTICLE_RE.findall(html)
    best = max((to_text(c) for c in candidates), key=len, default="")
    if len(best.replace(" ", "")) >= _EMPTY_SHELL_CHARS:
        return best
    return to_text(html)


def content_len(html: str) -> int:
    """공백을 뺀 본문 글자 수."""
    return len(content_text(html).replace(" ", ""))


def full_text(html: str) -> str:
    """문서 전체의 평문. 푸터와 네비게이션까지 포함한다."""
    return to_text(html)


def page_text(html: str) -> str:
    """푸터와 네비게이션을 뺀 문서 평문.

    범위가 셋으로 갈리는 이유를 정리해 둔다. 섞어 쓰면 각각 다른 방향으로 틀린다.

    - `content_text` — 얇은 페이지 판정용. 본문 영역만 본다.
      네비게이션과 푸터를 함께 세면 빈 페이지도 수천 자로 보인다.
    - `page_text` — 메타데이터 검출용. 본문 밖이지만 페이지 고유한 영역까지 본다.
      작성일은 본문이 아니라 머리말에 놓이는 것이 보통이라 본문만 보면 놓친다.
      반대로 푸터를 포함하면 사이트 운영자 링크를 글 저자로 오인한다.
      실제로 푸터의 "GitHub @이름" 을 저자 표기로 잘못 센 적이 있다.
    - `full_text` — 전체. 사이트 공통 요소까지 포함해야 할 때만.
    """
    t = _FOOTER_RE.sub(" ", html)
    t = _NAV_RE.sub(" ", t)
    t = _HEADER_RE.sub(" ", t)
    return to_text(t)
