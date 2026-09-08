# FOS Study Blog

GitHub 저장소의 마크다운 파일을 자동으로 동기화하여 렌더링하는 개발자 블로그입니다.

🌐 **Live:** https://blog.fosworld.co.kr

## 주요 기능

- **GitHub 자동 동기화** — `jon890/fos-study` 저장소의 마크다운 파일을 MySQL에 캐싱
- **마크다운 렌더링** — GFM, 코드 하이라이팅(shiki dual theme), Mermaid 다이어그램
- **카테고리/폴더 탐색** — GitHub 디렉토리 구조 기반 자동 분류
- **전문 검색** — MySQL FULLTEXT 인덱스 기반 포스트 검색
- **댓글 시스템** — 포스트별 댓글 (MySQL 저장)
- **방문자 통계** — 포스트 조회수 추적
- **다크/라이트 모드**
- **구조화 로깅**: pino JSON과 개발 환경의 pino-pretty
- **공통 관리자**: 허용한 GitHub 계정의 로그인·로그아웃과 비공개 관리자 홈
- **개인 학습자료 저장**: 서비스 수집과 관리자 자료 조회·개인 상태 API. 추천과 공부 화면은 후속 구현

## 기술 스택

| 구분          | 기술                                           |
| ------------- | ---------------------------------------------- |
| 프레임워크    | Next.js 16 (App Router + Turbopack)            |
| 언어          | TypeScript (strict)                            |
| 스타일링      | Tailwind CSS v4                                |
| 데이터베이스  | MySQL 8.4 + Drizzle ORM                        |
| GitHub 연동   | @octokit/rest                                  |
| 관리자 인증 | Better Auth, GitHub OAuth와 MySQL 세션 |
| 마크다운      | `unified` 기반 변환<br>GFM·KaTeX·Mermaid·Shiki |
| 로깅          | pino                                           |
| 패키지 매니저 | pnpm                                           |

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 필수 항목:

```env
GITHUB_TOKEN=ghp_...               # GitHub PAT (API rate limit 대응)
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
DATABASE_URL=mysql://fos_user:fos_password@localhost:13307/fos_blog
SYNC_API_KEY=your_random_key       # /api/sync 엔드포인트 보호용
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

관리자 인증 설정은 [.env.example](./.env.example)과 [관리자 환경 설정](./docs/code-architecture.md#관리자-인증-환경-설정과-자격증명-부재)을 따른다.
설정이 없으면 공개 블로그는 계속 동작하고 관리자 로그인에 설정 안내를 표시한다.
공부·추천 이력·이력 가져오기 메뉴는 후속 화면 구현 전까지 준비 중으로 표시한다.

### 3. 데이터베이스 시작 및 스키마 적용

```bash
docker compose -f local/docker-compose.yml up -d
pnpm db:migrate:runtime
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000에서 확인할 수 있습니다.

### 5. 콘텐츠 동기화

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <SYNC_API_KEY>"
```

## 유용한 명령어

```bash
pnpm dev           # 개발 서버
pnpm build         # 프로덕션 빌드
pnpm lint          # ESLint
pnpm type-check    # TypeScript 검사
pnpm test          # 테스트 (Vitest)

docker compose -f local/docker-compose.yml up -d
docker compose -f local/docker-compose.yml down
pnpm db:studio     # Drizzle Studio GUI
pnpm db:generate   # 마이그레이션 파일 생성
pnpm db:migrate:runtime # 마이그레이션 적용
```

실DB 테스트는 loopback의 `fos_blog_test_` 접두사 DB를 `TEST_DATABASE_URL`로 지정해 실행한다.
일반 `DATABASE_URL`을 테스트 DB로 대신 사용하지 않는다.

```bash
RUN_DB_TESTS=1 pnpm test --fileParallelism=false
```

## 프로젝트 구조

```
fos-blog/
├── src/
│   ├── app/              # Next.js 페이지 + API 라우트
│   ├── components/       # 재사용 UI 컴포넌트
│   ├── services/         # 비즈니스 로직 (동기화, 포스트 조회)
│   ├── infra/
│   │   ├── db/           # Drizzle 스키마 + 레포지토리
│   │   └── github/       # GitHub API 클라이언트
│   ├── lib/              # 공유 유틸 (markdown, logger)
│   ├── middleware/       # 방문 기록 (visit.ts), rate limit (rateLimit.ts)
│   └── proxy.ts          # 미들웨어 thin orchestrator
├── local/                # Docker Compose + MySQL 초기화
├── drizzle/              # 마이그레이션 파일 (자동 생성)
└── Dockerfile            # 홈서버 배포용
```

## 배포

**홈서버(Docker) 환경에 배포합니다.**

```bash
docker build -t fos-blog .
docker run -d --name fos-blog -p 3000:3000 --env-file .env fos-blog
```

콘텐츠 자동 동기화 (crontab):

```bash
0 * * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_API_KEY"
```

## 라이선스

MIT License
