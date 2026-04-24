# Phase 01 — .env.example 업데이트 + nginx 가이드 검증 + 빌드 smoke test

## 컨텍스트 (자기완결 프롬프트)

메인 도메인을 `fosworld.co.kr` → `blog.fosworld.co.kr` 로 전환 (ADR-013). 이 phase 는 **코드 측** 만 수정하고 인프라 변경은 문서로만 안내 (실제 nginx/env 배포는 사용자 수동). 코드 내 하드코딩된 도메인 참조가 **없음** 을 git grep 으로 선검증 후, `.env.example` 교체 → 빌드 산출물의 canonical/sitemap 이 새 도메인으로 재생성되는지 확인.

## 먼저 읽을 문서

- `docs/adr.md` — ADR-013 (도메인 전환 결정 근거)
- `docs/deployment.md` — nginx 설정 예시, 배포 체크리스트
- `src/env.ts` — 환경변수 스키마
- `.claude/skills/_shared/common-critic-patterns.md` — P4 (cwd), P5 (기계 검증)

## 기존 코드 참조

- `.env.example` — 현재 `NEXT_PUBLIC_SITE_URL` 값 (`fosworld.co.kr`)
- `src/app/layout.tsx:26` — `const siteUrl = env.NEXT_PUBLIC_SITE_URL`
- `src/app/sitemap.ts:13` — `const baseUrl = env.NEXT_PUBLIC_SITE_URL`
- `src/app/robots.ts:5` — 동일 패턴

## 사전 게이트 (작업 시작 전 필수)

```bash
# cwd: <worktree root>

# 1) 하드코딩된 fosworld.co.kr 참조 없음 확인 (env 경유 제외)
! grep -rn "fosworld\.co\.kr" src/ next.config.ts 2>/dev/null | grep -v "env\."
```

참조가 남아 있으면 **PHASE_BLOCKED: 하드코딩 제거 별도 처리 필요**.

## 작업 목록 (총 3개)

### 1. `.env.example` 의 `NEXT_PUBLIC_SITE_URL` 교체

```diff
- NEXT_PUBLIC_SITE_URL=https://fosworld.co.kr
+ NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr
```

주석 추가 (바로 위 라인):

```
# 메인 도메인. fosworld.co.kr 은 /ads.txt 를 제외한 모든 경로를 이 URL 로 301 리디렉션 (ADR-013)
```

### 2. 빌드 smoke test — canonical/sitemap 재생성 확인

```bash
# cwd: <worktree root>
cp .env.example .env.local.test
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build
```

빌드 산출물에서 새 도메인 반영 확인:

```bash
# cwd: <worktree root>
# 빌드 결과에 blog.fosworld.co.kr 반영 확인
grep -r "blog\.fosworld\.co\.kr" .next/server/app/sitemap.xml.body 2>/dev/null | head -3 || \
  grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -5

# 구 도메인 (env 값 제외) 흔적 없음 확인
! grep -rn "fosworld\.co\.kr/posts" .next/server/app/ 2>/dev/null | grep -v "blog\.fosworld" | head
```

### 3. 배포 체크리스트 간략 README 업데이트

`README.md` 최하단에 deployment 문서로 링크 추가:

```md
## 배포

홈서버 배포 절차 + nginx 설정은 [`docs/deployment.md`](./docs/deployment.md) 참조.
도메인 전환(ADR-013) 관련 수동 절차 포함.
```

이미 README 에 배포 섹션이 있으면 링크만 교체 (중복 피함).

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) .env.example 교체 확인
grep -n "NEXT_PUBLIC_SITE_URL=https://blog\.fosworld\.co\.kr" .env.example
! grep -n "NEXT_PUBLIC_SITE_URL=https://fosworld\.co\.kr" .env.example

# 2) 하드코딩 참조 여전히 없음
! grep -rn "fosworld\.co\.kr" src/ next.config.ts 2>/dev/null | grep -v "env\."

# 3) 배포 문서 존재
test -f docs/deployment.md
grep -n "blog.fosworld.co.kr" docs/deployment.md
grep -n "ads.txt" docs/deployment.md
grep -n "return 301" docs/deployment.md

# 4) README 에 deployment 링크
grep -n "docs/deployment.md" README.md

# 5) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build

# 6) 빌드 산출물에 새 도메인 반영 (sample path)
grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -3
```

## PHASE_BLOCKED 조건

- 하드코딩된 `fosworld.co.kr` 참조 발견 → **PHASE_BLOCKED: 참조 제거 범위 재설정 필요**
- 빌드 산출물에 구 도메인이 env 경유 외 경로로 남음 → **PHASE_BLOCKED: 정적 리소스/메타 생성 로직 재검토 필요**
- `pnpm build` 실패 → **PHASE_BLOCKED: Next.js 빌드 에러 로그 분석 필요**

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 최종 검증 후 일괄 커밋.

## 사용자 수동 작업 (이 phase 범위 밖)

실제 배포 전환은 사용자가 직접 수행:

1. 프로덕션 `.env` 의 `NEXT_PUBLIC_SITE_URL` 을 `https://blog.fosworld.co.kr` 로 변경
2. `docs/deployment.md` 의 nginx 설정을 `/etc/nginx/sites-available/fosworld.co.kr` 에 반영
3. `sudo nginx -t && sudo systemctl reload nginx`
4. `docker build && docker run` 으로 앱 재배포
5. `curl -I https://fosworld.co.kr/` → `301 Location: https://blog.fosworld.co.kr/`  확인
6. `curl https://fosworld.co.kr/ads.txt` → `curl https://blog.fosworld.co.kr/ads.txt` 결과 동일 확인
7. GSC 에 새 sitemap (`https://blog.fosworld.co.kr/sitemap.xml`) 제출
