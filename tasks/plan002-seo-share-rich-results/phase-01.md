# Phase 01 — 정적 OG 자산 + 폰트 subset + JsonLd/layout metadata 수정

## 컨텍스트 (자기완결 프롬프트)

소셜 공유 CTR + Google Rich Results 복구를 위한 정적 자산 계층 구축. 이 phase 는 phase-02(동적 OG) 의 전제 자산을 깔아둔다. **동적 OG 이미지 생성은 phase-02 에서 처리** — 이 phase 는 자산/fallback/메타 설정만.

### 전제 조건 (실행 전 확인)

아래 두 파일이 이미 main 에 커밋되어 있어야 한다. 없으면 `PHASE_BLOCKED`:

```bash
# cwd: <worktree root>
test -f public/logo.png
test -f public/og-default.png
```

- `public/logo.png` — 512×512 정사각, schema.org Article publisher.logo 용
- `public/og-default.png` — 1200×630, Open Graph / Twitter 기본 이미지

파일 준비는 사용자가 나노바나나로 별도 생성 후 commit. executor 가 생성하지 않는다.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-007 (OG 전략), ADR-008 (폰트 subset)
- `src/components/JsonLd.tsx` — 현재 `publisher.logo` 버그 위치(line 69)
- `src/app/layout.tsx` — metadata.openGraph 확장 대상
- `.claude/skills/_shared/common-critic-patterns.md` — BLG1/BLG2

## 기존 코드 참조

- `src/components/JsonLd.tsx:35-80` — `ArticleJsonLd` 현재 구현
- `src/app/layout.tsx:28-90` — 루트 metadata 블록

## 작업 목록 (총 4개)

### 1. `scripts/build-og-fonts.py` 생성

파일: `scripts/build-og-fonts.py`

```python
#!/usr/bin/env python3
"""
Noto Sans KR Bold 를 OG 이미지용으로 subset.
- 대상: 한글 완성형 (U+AC00-U+D7A3, 2350자) + Basic Latin (U+0020-U+007E) + 일반 구두점
- 결과: public/fonts/NotoSansKR-Bold-subset.woff2
"""
```

구현 요구:
- `fonttools` (pyftsubset) 사용
- 원본 폰트 소스 (ADR-008): **Noto 프로젝트 공식 GitHub release 사용** — `https://github.com/notofonts/noto-cjk/releases` 의 Hangul OTF/TTF 또는 변환된 woff2. `fonts.gstatic.com` CDN은 auto-subset 결과라 원본 글리프 전체가 없어 `pyftsubset` 입력으로 부적합. 접근 불가 시 PHASE_BLOCKED.
- unicode range (ADR-008 반영): `U+0020-007E,U+AC00-D7A3,U+2010-2026,U+3000-303F,U+FF00-FFEF`
  - `U+AC00-D7A3` = Unicode Hangul Syllables 블록 전체 (11,172자) — 모든 한글 렌더 보장
- 출력 path: `public/fonts/NotoSansKR-Bold-subset.woff2`
- 스크립트는 멱등 (이미 있으면 덮어쓰기)
- stdout 에 "subset size: {bytes}" 출력
- 실패 시 exit code != 0

실행 문서: 스크립트 상단 docstring 에 "의존성: `pip install fonttools brotli`" 명시.

### 2. subset woff2 파일 생성 + commit 대상 확인

```bash
# cwd: <worktree root>
pip install --quiet fonttools brotli
python3 scripts/build-og-fonts.py
ls -la public/fonts/NotoSansKR-Bold-subset.woff2
```

검증:
- 파일 존재
- 파일 크기 < 800KB (ADR-008 목표 ~500KB, 한도 800KB). 800KB 초과 시 PHASE_BLOCKED

### 3. `src/components/JsonLd.tsx` publisher.logo URL 고정값 + width/height

기존 (line 64-71의 `publisher` 블록, 수정 대상은 `logo` sub-object):
```ts
publisher: {
  "@type": "Organization",
  name: "FOS Study",
  logo: {
    "@type": "ImageObject",
    url: `${url.split("/").slice(0, 3).join("/")}/icon`,
  },
},
```

수정 후:
```ts
publisher: {
  "@type": "Organization",
  name: "FOS Study",
  logo: {
    "@type": "ImageObject",
    url: `${url.split("/").slice(0, 3).join("/")}/logo.png`,
    width: 512,
    height: 512,
  },
},
```

- URL 을 `/logo.png` 로 변경 (실존 파일)
- `width`, `height` 추가 (schema.org ImageObject 권장)
- 다른 property(mainEntityOfPage 등)는 건드리지 않음

### 4. `src/app/layout.tsx` metadata 확장

기존 openGraph/twitter 블록(line 60-72) 에 `images` 필드 추가:

```ts
openGraph: {
  type: "website",
  locale: "ko_KR",
  url: siteUrl,
  siteName: "FOS Study",
  title: "FOS Study - 개발 학습 블로그",
  description: "개발 공부 기록을 정리하는 블로그입니다.",
  images: [
    {
      url: `${siteUrl}/og-default.png`,
      width: 1200,
      height: 630,
      alt: "FOS Study — 개발 학습 블로그",
    },
  ],
},
twitter: {
  card: "summary_large_image",
  title: "FOS Study - 개발 학습 블로그",
  description: "개발 공부 기록을 정리하는 블로그입니다.",
  images: [`${siteUrl}/og-default.png`],
},
```

- 이미지 URL 은 absolute (metadataBase 있지만 안전하게 절대경로)
- alt 포함
- 다른 필드는 건드리지 않음

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) 전제 자산 존재
test -f public/logo.png
test -f public/og-default.png

# 2) 스크립트 + 생성물 (ADR-008 한도 800KB)
test -f scripts/build-og-fonts.py
test -f public/fonts/NotoSansKR-Bold-subset.woff2
[ "$(stat -f%z public/fonts/NotoSansKR-Bold-subset.woff2 2>/dev/null || stat -c%s public/fonts/NotoSansKR-Bold-subset.woff2)" -lt 819200 ]

# 3) JsonLd.tsx 수정 확인
grep -n 'url: `${url.split("/").slice(0, 3).join("/")}/logo.png`' src/components/JsonLd.tsx
grep -n 'width: 512' src/components/JsonLd.tsx
grep -n 'height: 512' src/components/JsonLd.tsx
! grep -n '/icon`' src/components/JsonLd.tsx

# 4) layout.tsx openGraph.images / twitter.images
grep -n '/og-default.png' src/app/layout.tsx
grep -nE 'alt:\s*"FOS Study' src/app/layout.tsx

# 5) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
pnpm build

# 6) 빌드 산출물에 자산 포함 확인 (standalone)
test -f .next/standalone/public/logo.png || test -f .next/static/og-default.png || test -f public/logo.png
```

## PHASE_BLOCKED 조건

- 전제 자산(`public/logo.png`, `public/og-default.png`) 미존재 → **PHASE_BLOCKED: 사용자가 나노바나나로 이미지 생성 후 commit 필요**
- `pip install fonttools` 가 환경에 없고 설치 권한 없음 → **PHASE_BLOCKED: CI/로컬 Python 환경 확인 필요**
- `notofonts/noto-cjk` GitHub release 접근 불가 → **PHASE_BLOCKED: 원본 폰트 소스 대체 URL 결정 필요**
- subset 결과 크기가 800KB(ADR-008 한도) 초과 → **PHASE_BLOCKED: unicode range 좁히기 vs ADR-008 한도 재조정 사용자 결정 필요**

## 커밋 제외

executor 는 이 phase 내부에서 커밋하지 않는다. team-lead 가 phase-02 완료 후 일괄 커밋.
