# FOS Study Blog

GitHub 저장소의 마크다운 파일을 자동으로 가져와 보여주는 개발자 블로그입니다.

## 주요 기능

- GitHub 저장소(jon890/fos-study)의 마크다운 파일 자동 연동
- 카테고리별 글 분류 (AI, algorithm, architecture, database, devops 등)
- 마크다운 렌더링 (코드 하이라이팅, GFM 지원)
- 다크/라이트 모드 지원
- 반응형 디자인
- ISR(Incremental Static Regeneration)으로 1시간마다 자동 갱신

## 기술 스택

- **프레임워크**: Next.js 16 (App Router + Turbopack)
- **스타일링**: Tailwind CSS v4
- **마크다운 렌더링**: react-markdown + remark-gfm + rehype-highlight
- **GitHub 연동**: Octokit (GitHub REST API)
- **데이터베이스**: Drizzle ORM + MySQL
- **테마**: next-themes
- **패키지 매니저**: pnpm

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 GitHub 토큰을 설정합니다:

```bash
cp .env.example .env.local
```

```env
# GitHub Personal Access Token (선택사항, rate limit 대응용)
GITHUB_TOKEN=your_github_token_here

# GitHub 저장소 정보
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000에서 블로그를 확인할 수 있습니다.

### 4. 데이터베이스 설정 (선택사항)

MySQL을 사용하면 GitHub API 호출 없이 빠르게 페이지를 로드할 수 있습니다.

#### Docker Compose로 MySQL 실행

```bash
# MySQL 컨테이너 시작
docker compose up -d

# 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f db
```

#### 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사:

```bash
cp .env.local.example .env.local
```

#### DB 스키마 적용 및 데이터 동기화

```bash
# 스키마 생성
pnpm db:push

# GitHub 데이터를 DB에 동기화
pnpm sync

# DB 관리 UI 실행 (선택사항)
pnpm db:studio
```

### 5. 프로덕션 빌드

```bash
pnpm build
pnpm start
```

## 배포

Vercel에 배포하는 것을 권장합니다:

1. [Vercel](https://vercel.com)에서 GitHub 저장소 연결
2. 환경 변수 설정 (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)
3. 배포 완료!

## 프로젝트 구조

```
fos-blog/
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx             # 홈페이지
│   ├── categories/          # 카테고리 전체 목록
│   ├── category/[category]/ # 카테고리별 글 목록
│   └── posts/[...slug]/     # 글 상세 페이지
├── components/
│   ├── Header.tsx           # 헤더/네비게이션
│   ├── PostCard.tsx         # 글 카드
│   ├── CategoryCard.tsx     # 카테고리 카드
│   ├── MarkdownRenderer.tsx # 마크다운 렌더링
│   └── ThemeToggle.tsx      # 다크모드 토글
├── lib/
│   ├── github.ts            # GitHub API 유틸리티
│   └── markdown.ts          # 마크다운 파싱 유틸리티
└── ...
```

## 라이선스

MIT License
