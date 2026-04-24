# Phase 01 — 구 도메인 하드코딩 일괄 교체 + `.env.example` + 빌드 smoke test

## 컨텍스트 (자기완결 프롬프트)

메인 도메인을 `fosworld.co.kr` → `blog.fosworld.co.kr` 로 전환 (ADR-013). 이 phase 는 **코드 측** 만 수정한다. 실제 nginx/env 프로덕션 반영 및 구체 홈서버 설정 변경은 **저장소 외부에서 수행** (보안상 공개 저장소에 홈서버 설정을 기록하지 않는다).

코드·빌드·CI 전 영역에 박혀 있는 구 도메인 하드코딩 5곳을 일괄 교체하고, 빌드 smoke test 로 새 도메인이 번들에 반영됨을 확인.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-013 (도메인 전환 결정 근거)
- `src/env.ts` — 환경변수 스키마
- `.claude/skills/_shared/common-critic-patterns.md` — P1 (실측), P4 (cwd), P5 (기계 검증)

## 기존 코드 참조 (실측)

**구 도메인 하드코딩 위치 (5개 파일):**

- `src/env.ts:25` — `NEXT_PUBLIC_SITE_URL: z.string().url().default("https://fosworld.co.kr")`
- `vitest.config.ts:12` — `NEXT_PUBLIC_SITE_URL: "https://fosworld.co.kr"`
- `Dockerfile:25` — `ARG NEXT_PUBLIC_SITE_URL=https://fosworld.co.kr` (빌드 시 JS 번들에 인라인)
- `.github/workflows/ci.yml:48` — `NEXT_PUBLIC_SITE_URL: https://fosworld.co.kr` (CI 빌드 환경변수)
- `.github/workflows/lighthouse.yml:22-24` — `https://fosworld.co.kr`, `/categories`, `/posts/...` 3건

**env 경유 (수정 불필요):**

- `.env.example:46` — `NEXT_PUBLIC_SITE_URL=https://your-domain.com` (플레이스홀더, 작업 2 에서 별도 처리)
- `src/app/layout.tsx:27`, `src/app/sitemap.ts`, `src/app/robots.ts` — `env.NEXT_PUBLIC_SITE_URL`

## 작업 목록 (총 3개)

### 1. 구 도메인 하드코딩 5곳 일괄 교체

아래 5곳에서 `https://fosworld.co.kr` 문자열을 `https://blog.fosworld.co.kr` 로 교체:

```diff
# src/env.ts:25
- NEXT_PUBLIC_SITE_URL: z.string().url().default("https://fosworld.co.kr"),
+ NEXT_PUBLIC_SITE_URL: z.string().url().default("https://blog.fosworld.co.kr"),

# vitest.config.ts:12
-      NEXT_PUBLIC_SITE_URL: "https://fosworld.co.kr",
+      NEXT_PUBLIC_SITE_URL: "https://blog.fosworld.co.kr",

# Dockerfile:25
- ARG NEXT_PUBLIC_SITE_URL=https://fosworld.co.kr
+ ARG NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr

# .github/workflows/ci.yml:48
-           NEXT_PUBLIC_SITE_URL: https://fosworld.co.kr
+           NEXT_PUBLIC_SITE_URL: https://blog.fosworld.co.kr

# .github/workflows/lighthouse.yml:22-24
-             https://fosworld.co.kr
-             https://fosworld.co.kr/categories
-             https://fosworld.co.kr/posts/AI/RAG/embedding.md
+             https://blog.fosworld.co.kr
+             https://blog.fosworld.co.kr/categories
+             https://blog.fosworld.co.kr/posts/AI/RAG/embedding.md
```

**중요:** `blog.fosworld.co.kr` 는 이미 `fosworld.co.kr` 를 부분문자열로 포함하므로, 단순 sed 로 `fosworld.co.kr` → `blog.fosworld.co.kr` 하면 `blog.blog.fosworld.co.kr` 로 이중 prefix 가 된다. 반드시 `https://fosworld.co.kr` → `https://blog.fosworld.co.kr` 전체 패턴으로 교체하거나, 이미 `blog.` prefix 가 있는 라인은 제외한 후 교체.

### 2. `.env.example:46` `NEXT_PUBLIC_SITE_URL` 교체 + 주석 보강

현재 46 라인:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

다음과 같이 교체 (바로 위 라인에 주석 추가):

```
# 메인 도메인. fosworld.co.kr 은 /ads.txt 를 제외한 모든 경로를 이 URL 로 301 리디렉션 (ADR-013)
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr
```

### 3. 빌드 smoke test — canonical/sitemap 재생성 확인

```bash
# cwd: <worktree root>
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build
```

빌드 산출물에서 새 도메인 반영 확인:

```bash
# cwd: <worktree root>
grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -5

# 구 도메인 (env 경유 제외) 흔적 없음 확인
! grep -rn "fosworld\.co\.kr/posts" .next/server/app/ 2>/dev/null | grep -v "blog\.fosworld" | head
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) src/env.ts default 가 신도메인
grep -n 'default("https://blog\.fosworld\.co\.kr")' src/env.ts

# 2) vitest.config.ts 기본값이 신도메인
grep -n '"https://blog\.fosworld\.co\.kr"' vitest.config.ts

# 3) Dockerfile ARG 기본값이 신도메인
grep -n "ARG NEXT_PUBLIC_SITE_URL=https://blog\.fosworld\.co\.kr" Dockerfile

# 4) CI 빌드 env 가 신도메인
grep -n "NEXT_PUBLIC_SITE_URL: https://blog\.fosworld\.co\.kr" .github/workflows/ci.yml

# 5) lighthouse audit URL 3건 모두 신도메인
[ "$(grep -c "https://blog\.fosworld\.co\.kr" .github/workflows/lighthouse.yml)" = "3" ]

# 6) .env.example 이 신도메인 (positive assert)
grep -n "NEXT_PUBLIC_SITE_URL=https://blog\.fosworld\.co\.kr" .env.example

# 7) 저장소 전 영역에서 `blog.` 가 아닌 구 도메인 하드코딩 참조 없음
#    (env 경유 `env.NEXT_PUBLIC_SITE_URL` 은 정상, docs/ 의 의도적 언급은 범위 밖)
! grep -rn "fosworld\.co\.kr" \
    src/ next.config.ts vitest.config.ts Dockerfile \
    .github/workflows/ .env.example 2>/dev/null \
    | grep -v "blog\.fosworld" \
    | grep -v "env\."

# 8) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build

# 9) 빌드 산출물에 새 도메인 반영
grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -3
```

## PHASE_BLOCKED 조건

- 작업 1~2 완료 후에도 성공 기준 #7 에서 추가 참조 발견 → **PHASE_BLOCKED: 참조 제거 범위 재설정 필요**
- 빌드 산출물에 구 도메인이 env 경유 외 경로로 남음 → **PHASE_BLOCKED: 정적 리소스/메타 생성 로직 재검토 필요**
- `pnpm build` / `pnpm test --run` / `pnpm lint` / `pnpm type-check` 실패 → **PHASE_BLOCKED: 로그 분석 필요**

## 커밋 제외

executor 는 커밋하지 않는다. team-lead 가 최종 검증 후 일괄 커밋.

## 이 phase 범위 밖 (별도 수행)

실제 홈서버 전환 작업 (nginx/NPM 설정 변경, `.env` 업데이트, 컨테이너 재기동, GSC sitemap 재제출 등) 은 저장소 외부에서 수행한다. 홈서버 인프라 세부 설정(IP, 컨테이너 이름, 경로, SSL 인증서 경로, 프록시 호스트 구성 등) 은 공개 저장소에 기록하지 않는다.
