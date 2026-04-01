<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-04-01 -->

# lib

## Purpose

공유 유틸리티 함수 모음. React 의존성 없는 순수 TypeScript 모듈. 마크다운 처리, 로깅, 경로 유틸리티를 제공한다. 모든 레이어(`app/`, `services/`, `infra/`)에서 공통으로 사용한다.

> **참고:** GitHub API 클라이언트와 이미지 재작성 유틸은 `src/infra/github/`로 이동했다.

## Key Files

| File | Description |
|------|-------------|
| `markdown.ts` | 마크다운 파싱 — `parseFrontMatter()`, `extractTitle()`, `extractDescription()`, `getReadingTime()`, `generateTableOfContents()` (github-slugger로 slug 생성, rehype-slug와 동일 출력) |
| `markdown.test.ts` | markdown.ts 단위 테스트 |
| `resolve-markdown-link.ts` | GitHub raw URL → 블로그 상대 URL 변환 |
| `resolve-markdown-link.test.ts` | 링크 변환 단위 테스트 |
| `path-utils.ts` | 경로 유틸리티 — 슬러그 생성, 폴더 경로 처리 |
| `logger.ts` | pino 구조화 로거 — 개발 환경에서 pino-pretty 사용, 프로덕션에서 JSON 출력 |
| `logger.test.ts` | logger 초기화 및 child 생성 테스트 |
| `sync-github.ts` | **(레거시)** 이전 동기화 로직 — 현재는 `src/services/` + `src/infra/github/`로 분리됨. 테스트 참조용으로 유지 |
| `sync-github.test.ts` | sync-github.ts 레거시 테스트 |

## For AI Agents

### Working In This Directory

- `markdown.ts`의 `generateTableOfContents()`는 `github-slugger`를 사용한다 — `rehype-slug`와 slug 방식을 바꾸면 반드시 함께 변경해야 한다
- `logger.ts`는 `pino.transport()` 조건 분기가 isDev 기준으로 명확히 분리되어 있다 — 싱글턴이므로 앱 전체에서 `logger.child({ module: '...' })`로 사용한다
- `sync-github.ts`는 레거시 파일이다 — 새 동기화 로직은 `src/services/` + `src/infra/github/`에 작성한다
- 이 디렉토리의 모든 함수는 side-effect 없는 순수 함수여야 한다 (logger 제외)

### Key Exports from `markdown.ts`

```ts
parseFrontMatter(content)        // { frontMatter, content } — YAML 헤더 파싱
extractTitle(content)            // frontmatter 또는 첫 h1
extractDescription(content, max) // frontmatter 또는 첫 단락
getReadingTime(content)          // 예상 읽기 시간 (분, 200wpm 기준)
generateTableOfContents(content) // TocItem[] — { level, text, slug }
```

### Key Exports from `logger.ts`

```ts
import logger from "@/lib/logger";

const log = logger.child({ module: "MyModule" });
log.info({ key: "value" }, "메시지");
log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "에러 메시지");
```

### Testing Requirements

- 테스트는 `pnpm test` 또는 `pnpm test -- src/lib/<파일명>`
- logger 테스트는 실제 pino 인스턴스를 사용 (모킹 불필요)
- sync-github 테스트는 GitHub API를 모킹해야 함

## Dependencies

### Internal
- `src/infra/db/` — (레거시 sync-github.ts에서만 사용)

### External
- `pino`, `pino-pretty` — 구조화 로깅
- `github-slugger` — 헤딩 slug 생성 (rehype-slug와 동일 출력)

<!-- MANUAL: -->
