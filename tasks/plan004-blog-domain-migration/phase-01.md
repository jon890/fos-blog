# Phase 01 — .env.example 업데이트 + 빌드 smoke test

## 컨텍스트 (자기완결 프롬프트)

메인 도메인을 `fosworld.co.kr` → `blog.fosworld.co.kr` 로 전환 (ADR-013). 이 phase 는 **코드 측** 만 수정한다. 실제 nginx/env 프로덕션 반영 및 구체 홈서버 설정 변경은 **저장소 외부에서 수행** (보안상 공개 저장소에 홈서버 설정을 기록하지 않는다).

## 먼저 읽을 문서

- `docs/adr.md` — ADR-013 (도메인 전환 결정 근거)
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

## 작업 목록 (총 2개)

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
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build
```

빌드 산출물에서 새 도메인 반영 확인:

```bash
# cwd: <worktree root>
# 빌드 결과에 blog.fosworld.co.kr 반영 확인
grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -5

# 구 도메인 (env 값 제외) 흔적 없음 확인
! grep -rn "fosworld\.co\.kr/posts" .next/server/app/ 2>/dev/null | grep -v "blog\.fosworld" | head
```

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) .env.example 교체 확인
grep -n "NEXT_PUBLIC_SITE_URL=https://blog\.fosworld\.co\.kr" .env.example
! grep -n "NEXT_PUBLIC_SITE_URL=https://fosworld\.co\.kr" .env.example

# 2) 하드코딩 참조 여전히 없음
! grep -rn "fosworld\.co\.kr" src/ next.config.ts 2>/dev/null | grep -v "env\."

# 3) 통합 검증
pnpm lint
pnpm type-check
pnpm test --run
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr pnpm build

# 4) 빌드 산출물에 새 도메인 반영
grep -rn "blog\.fosworld\.co\.kr" .next/server/app/ 2>/dev/null | head -3
```

## PHASE_BLOCKED 조건

- 하드코딩된 `fosworld.co.kr` 참조 발견 → **PHASE_BLOCKED: 참조 제거 범위 재설정 필요**
- 빌드 산출물에 구 도메인이 env 경유 외 경로로 남음 → **PHASE_BLOCKED: 정적 리소스/메타 생성 로직 재검토 필요**
- `pnpm build` 실패 → **PHASE_BLOCKED: Next.js 빌드 에러 로그 분석 필요**

## 커밋 제외

executor 는 커밋하지 않는다. team-lead 가 최종 검증 후 일괄 커밋.

## 이 phase 범위 밖 (별도 수행)

실제 홈서버 전환 작업 (nginx/NPM 설정 변경, `.env` 업데이트, 컨테이너 재기동, GSC sitemap 재제출 등) 은 저장소 외부에서 수행한다. 홈서버 인프라 세부 설정(IP, 컨테이너 이름, 경로, SSL 인증서 경로, 프록시 호스트 구성 등) 은 공개 저장소에 기록하지 않는다.
