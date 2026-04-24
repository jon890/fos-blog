# FOS Study Blog

GitHub 저장소의 마크다운 파일을 자동으로 동기화하여 렌더링하는 개발자 블로그입니다.

🌐 **Live:** https://blog.fosworld.co.kr

## 주요 기능

- **GitHub 자동 동기화** — `jon890/fos-study` 저장소의 마크다운 파일을 MySQL에 캐싱
- **마크다운 렌더링** — GFM, 코드 하이라이팅(highlight.js), Mermaid 다이어그램
- **카테고리/폴더 탐색** — GitHub 디렉토리 구조 기반 자동 분류
- **전문 검색** — MySQL FULLTEXT 인덱스 기반 포스트 검색
- **댓글 시스템** — 포스트별 댓글 (MySQL 저장)
- **방문자 통계** — 포스트 조회수 추적
- **다크/라이트 모드**
- **구조화 로깅** — pino (JSON) + pino-pretty (개발 환경)

## 기술 스택

| 구분          | 기술                                           |
| ------------- | ---------------------------------------------- |
| 프레임워크    | Next.js 16 (App Router + Turbopack)            |
| 언어          | TypeScript (strict)                            |
| 스타일링      | Tailwind CSS v4                                |
| 데이터베이스  | MySQL 8.4 + Drizzle ORM                        |
| GitHub 연동   | @octokit/rest                                  |
| 마크다운      | react-markdown + remark-gfm + rehype-highlight |
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

### 3. 데이터베이스 시작 및 스키마 적용

```bash
pnpm db:up      # MySQL 컨테이너 시작 (local/docker-compose.yml)
pnpm db:push    # 스키마 적용
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

pnpm db:up         # MySQL 컨테이너 시작
pnpm db:down       # MySQL 컨테이너 중지
pnpm db:studio     # Drizzle Studio GUI
pnpm db:generate   # 마이그레이션 파일 생성
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
│   └── proxy.ts          # 미들웨어 (방문자 통계)
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
