# fos-blog 에이전트 작업 지침

**갱신일:** 2026-07-30 · **저장소:** `github.com/jon890/fos-blog` · **운영 주소:** `https://blog.fosworld.co.kr`

## 이 문서의 역할

이 문서는 모든 작업에 항상 적용하는 프로젝트 불변 조건만 담는다.
세부 실행 절차는 관련 스킬과 저장소 오버레이를 작업 시작 전에 읽는다.

지침은 다음 순서로 읽는다.

1. `CLAUDE.md` (= `AGENTS.md` 심볼릭 링크): 불변 조건과 검증 기준
2. 설치된 `SKILL.md`: 계획, 구현, 문서 점검, 리뷰 반영 절차
3. `.claude/*-overlay.md`: 공용 스킬에 주입하는 fos-blog 전용 규칙
4. `.claude/agents/*.md`, `.codex/agents/*.toml`: 역할별 책임과 출력 계약

반복되는 계획·검토 함정은 `.agents/skills/_shared/common-pitfalls.md`에 누적한다.

코드와 문서가 충돌하면 현재 동작은 코드와 설정으로 확인하고, 의사결정 이유는 문서에서 확인한다.
충돌을 발견하면 근거 없이 한쪽을 선택하지 말고 작업 범위 안에서 함께 정리한다.

## 프로젝트 개요

`jon890/fos-study`의 마크다운을 GitHub에서 동기화해 MySQL에 저장하고 웹으로 제공하는 Next.js 개발자 블로그다.
배포 대상은 홈서버의 Docker 컨테이너다.

기능 목록, 기술 스택, 디렉터리 구조는 `README.md`를 단일 소스로 삼는다.
패키지 버전은 `package.json`과 `pnpm-lock.yaml`에서 확인한다.

## 아키텍처 경계

의존 방향의 기본형은 `app → services → infra`이며 `lib`는 공용 기능을 제공한다.

- `app`은 라우팅과 조합을 담당한다.
  단순 조회 페이지나 Route Handler는 기존 방식대로 `getRepositories()`를 직접 사용할 수 있다.
- 여러 Repository를 조합하거나 외부 부수 효과를 다루는 도메인 흐름은 `services`에 둔다.
- `components`는 DB 연결이나 Repository 인스턴스를 만들지 않는다.
  표시용 타입과 상수 import는 기존 경계를 따른다.
- `infra`는 DB와 GitHub 같은 외부 시스템을 캡슐화한다.
- 새 추상화나 의존성보다 기존 Repository, 서비스, 유틸리티 재사용을 우선한다.

도메인 불변 조건은 다음과 같다.

- `posts.path`는 GitHub 파일 경로이며 고유 식별 기준이다.
- 글 조회는 특별한 이유가 없으면 `eq(posts.isActive, true)`를 포함한다.
- 동기화는 같은 입력을 반복해도 중복이나 데이터 손실이 없어야 한다.
- 스키마 단일 소스는 `src/infra/db/schema/`다.
- 마크다운 변경은 GFM, Mermaid, KaTeX, 링크 변환, HTML 정화 회귀를 함께 확인한다.

## 명령어

명령 목록은 `package.json`의 `scripts`를 단일 소스로 삼는다.
로컬 MySQL만 스크립트에 없고 Docker Compose로 실행한다.

```bash
docker compose -f local/docker-compose.yml up -d
docker compose -f local/docker-compose.yml down
```

## 환경 변수

실행 계약은 `src/env.ts`, 예시는 `.env.example`을 단일 소스로 삼는다.

`SYNC_API_KEY` 인증은 `/api/sync`에 적용한다.
모든 API Route가 Bearer 인증을 사용한다고 가정하지 않는다.

격리 worktree에서는 다음 순서로 환경을 준비한다.

```bash
pnpm install
[ -e .env ] || ln -s "$(dirname "$(git rev-parse --git-common-dir)")/.env" .env
```

## 구현 규칙

- TypeScript strict와 `@/*` 경로 별칭을 유지한다.
- 컴포넌트는 PascalCase와 이름 있는 export를 기본으로 한다.
- 서버 코드는 `@/lib/logger`의 자식 로거를 사용한다.
- `src/`에 `console.log`를 남기지 않는다.
- `scripts/*.ts`는 독립 실행 제약 때문에 `console.log`와 `console.error`를 사용할 수 있다.
- 클라이언트 컴포넌트는 서버 전용 pino를 import하지 않는다.
  실패는 UI로 알리고 catch 블록의 개발 진단에는 `console.error`만 사용한다.
- 알 수 없는 오류는 `error instanceof Error ? error : new Error(String(error))`로 정규화한다.
- `src/app/globals.css`는 Tailwind 자동 탐색을 끈다.
  Tailwind class가 있는 새 디렉터리를 만들면 `@source`를 추가한다.
- 명시적 승인 없이 새 의존성, `eslint-disable`, `@ts-ignore`, `@ts-nocheck`를 추가하지 않는다.

테스트는 대상 코드와 가까운 `*.test.ts` 또는 `*.test.tsx`에 둔다.
DOM 테스트는 파일 상단에 `// @vitest-environment jsdom`을 선언해 기본 Node 환경과 격리한다.

## DB 스키마 변경

1. `src/infra/db/schema/`를 수정한다.
2. `pnpm db:generate`로 `drizzle/` 산출물을 만든다.
3. 생성 SQL을 직접 편집하지 말고 파괴적 변경 여부를 검토한다.
4. 스키마 변경과 생성된 마이그레이션을 같은 커밋에 포함한다.
5. `pnpm db:migrate` 또는 `pnpm db:migrate:runtime`으로 적용을 검증한다.

프로덕션에 `pnpm db:push`를 사용하지 않는다.
`pnpm db:push`는 버려도 되는 로컬 실험에만 허용하며 커밋 전에 마이그레이션으로 바꾸거나 되돌린다.
컨테이너는 시작할 때 `migrate.js`를 실행한 뒤 `server.js`를 실행한다.

## 문서 작성

문서 책임은 설치된 `planning` 스킬의 “필수 관리 문서” 계약을 따른다.
구현 방법은 코드에 두고 문서에는 무엇을 결정했는지와 왜 결정했는지를 남긴다.

- 설명 문장은 자연스러운 한국어로 작성하고 점검, 분류, 표, 기준선 같은 직관적인 표현을 사용한다.
- 기술 식별자, 경로, 명령어, API 필드, 판정 토큰은 원문을 유지하고 백틱으로 감싼다.
- 한 문장 또는 의미 단위마다 줄을 나눈다.
- 한 문단이나 항목에 정보가 3개 이상이면 목록이나 표로 나눈다.
- 같은 규칙을 여러 문서에 복사하지 않고 단일 소스를 링크한다.
- 편집한 문서에서는 깨진 링크, 긴 문장, 중첩 괄호, 인라인 나열을 함께 정리한다.

Dooray, GitHub, 블로그, 메일처럼 외부에 게시할 문안은 등록 전에 채팅에서 본문을 미리 보여준다.
블로그 글은 가능하면 실제 스타일의 HTML 미리보기도 만든다.

## Git과 PR

`planning` 산출물 브랜치는 `plan{N}-<slug>` 형식을 사용한다.
그 밖의 브랜치와 커밋·PR 제목 형식은 기존 히스토리를 따른다.

PR 제목과 본문은 기본적으로 한국어로 작성한다.
본문에는 변경 이유와 내용을 요약하고 검증 항목을 체크리스트로 적는다.
PR은 검증이 끝났다면 검토 가능한 상태로 생성하고, 사용자가 요청했거나 검증이 끝나지 않았을 때만 초안으로 만든다.

커밋은 관심사별로 나눈다.
강하게 결합된 `package.json`과 `pnpm-lock.yaml`, 스키마와 생성 마이그레이션은 같은 커밋에 둔다.

## 검증과 완료 보고

변경 동작을 직접 증명하는 대상 테스트부터 실행한다.
그다음 `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` 순서로 검증 범위를 넓힌다.
CI(`.github/workflows/ci.yml`)와 같은 순서라 실패 지점이 일치한다.

문서만 변경했다면 링크, 경로, 명령어, 코드와의 사실 정합성을 우선 검증한다.

최종 보고에는 변경 파일, 바로잡거나 단순화한 내용, 검증 결과, 남은 위험을 포함한다.
