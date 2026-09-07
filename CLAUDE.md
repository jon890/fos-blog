# fos-blog 에이전트 작업 지침

**갱신일:** 2026-09-07 · **저장소:** `github.com/jon890/fos-blog` · **운영 주소:** `https://blog.fosworld.co.kr`

## 이 문서의 역할

이 문서는 모든 작업에 항상 적용하는 프로젝트 불변 조건만 담는다.
세부 실행 절차는 관련 스킬과 `.claude/*-overlay.md`를 작업 시작 전에 읽는다.

작업 종류별 규칙은 `.claude/rules/`에 둔다.
각 파일의 `paths` 조건에 맞는 작업에서 Claude Code가 자동으로 읽는다.
다른 하네스는 이 디렉터리를 모르므로 작업 전에 직접 확인한다.

역할 계약은 `.agents/roles/`가 단일 소스다.
`.claude/agents/*.md`와 `.codex/agents/*.toml`은 그 파일을 가리키는 얇은 래퍼이므로
역할을 고칠 때는 `.agents/roles/`를 고치고 래퍼는 건드리지 않는다.

작업에서 발견한 재발 사례는 [회고 목록](docs/retrospectives/INDEX.md)에서 찾아 해당 개별 문서에 기록한다.
현재 제품 계약은 기존 `docs/` 책임 문서에 반영하고, 회고는 그 문서를 링크한다.

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

구현과 리뷰는 [코드 작성과 테스트](docs/code-architecture.md#코드-작성과-테스트),
[로깅과 오류](docs/code-architecture.md#로깅과-오류)를 기준으로 한다.
명시적 승인 없이 새 의존성, `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`를 추가하지 않는다.

## Git과 PR

PR 작성은 설치된 `create-pr` 스킬을 따른다.
PR은 검증이 끝났다면 검토 가능한 상태로 생성하고, 사용자가 요청했거나 검증이 끝나지 않았을 때만 초안으로 만든다.

## 검증과 완료 보고

변경 동작을 직접 증명하는 대상 테스트부터 실행한다.
그다음 `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` 순서로 검증 범위를 넓힌다.
CI(`.github/workflows/ci.yml`)와 같은 순서라 실패 지점이 일치한다.

문서만 변경했다면 링크, 경로, 명령어, 코드와의 사실 정합성을 우선 검증한다.

최종 보고에는 변경 파일, 바로잡거나 단순화한 내용, 검증 결과, 남은 위험을 포함한다.
