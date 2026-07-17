# planning 오버레이 — fos-blog

공용 코어(`~/.claude/skills/planning`)에 fos-blog 특화를 주입한다.
코어의 8단계 skeleton 을 이 레포의 도메인(Next.js UI 블로그)·docs 컨벤션·검증에 맞춰 채운다.

## 도메인: UI (Next.js / React)

- **3단계 (사용자 흐름)**: 시니어 UX 리서처 관점. 화면 전환·사용자 액션·시스템 반응을 구체화. 엣지 케이스(에러/빈 상태/권한).
- **4단계 (화면/인터페이스)**: 각 화면의 정보·기능 체크리스트, 컴포넌트 구조 초안, 상태 관리 방식.
- **5단계 (API)**: Server Action vs API Route vs gRPC vs CLI command 판단. 요청/응답 스키마, 스트리밍 필요 여부.

## docs 컨벤션

갱신 대상 문서:

| 내용 유형 | 단일 소스 | 다른 문서 |
|---|---|---|
| 제품 목적 / MVP 범위 | `docs/prd.md` | flow 는 목표만 재언급 |
| 사용자 흐름 / 화면 전환 | `docs/flow.md` | prd 는 목표만, ADR 은 결정만 |
| DB 테이블 / 관계 / 제약 | `docs/data-schema.md` | ADR 은 결정 근거만 |
| 디렉터리 / 레이어 / API 전략 | `docs/code-architecture.md` | ADR 은 결정 근거만 |
| 기술 결정 근거 (왜) | `docs/adr/README.md` + `docs/adr/NNN-slug.md` | 다른 docs 는 ADR 번호 링크 |
| 페이지별 PRD | `docs/pages/{page}.md` | flow 는 흐름만 |

### ADR 자명성 점검 (작성 전 필수 자문)

아래 3개에 **모두 NO** 여야 ADR 로 기록. 하나라도 YES 면 대안 채널(CLAUDE.md/코드 주석/커밋 메시지/다른 docs)로.

1. `package.json`·lockfile·`docker-compose.yml`·Drizzle 스키마·디렉터리 트리·ESLint 설정 중 어느 하나를 보면 같은 정보를 얻는가?
2. "왜 X 를 선택했다" 를 1~2 문장 이상으로 설명하기 어려운가?
3. 다른 프로젝트에서도 일반적으로 하는 선택인가?

**유지 적격**(3개 모두 NO): 라이브러리 고유 함정 / 실험 결과(수치) / 대안 기각 근거 / 정책·규칙 / 비용·성능 트레이드오프.

### ADR 구조 템플릿

```markdown
## ADR-XXX: {제목 — 결정의 한 줄 요약}

- **결정**: {무엇을 — 1~3 문장}
- **맥락**: {왜 필요했는가 — 제약 / 데이터 / 관찰}
- **대안 기각**: {다른 옵션 각각 1~2 줄, 왜 아닌가}
- (선택) **트레이드오프**, **적용 범위**
```

**금지**: 코드 블록 10줄 이상 / 파일 경로 3개 이상 나열 / 작업 내역·삭제 목록 / CLAUDE.md 스택 규칙 반복.

### 거울 구조 원칙 (단일 소스 + docs-verifier 흡수)

1. **단일 소스**: 위 "문서 책임 표" 가 docs 갱신의 유일한 정의.
2. **거울**: `fos-blog-docs-verifier` agent 의 검증 항목은 위 표를 거울처럼 참조 — 별도 체크리스트 보유 금지.
3. **별도 회고 docs 신설 금지**: docs-verifier 반복 지적은 표에 행 추가로 흡수.
4. **표 수정 시 거울 동기 검토** — `.claude/agents/fos-blog-docs-verifier.md` 도메인 지식 섹션과 함께 갱신.

## 검증

- **common-pitfalls**: `.claude/skills/_shared/common-pitfalls.md` (섹션 1 = plan 작성 패턴). 코어 `verify-task.sh` 5 패턴은 이 시드에서 나왔다.
- 추가 패턴 없음 (코어 5 패턴으로 충분).

## 레이어별 phase 가이드

CLAUDE.md "Architecture" 의 레이어(app → services → infra, lib 는 횡단) 기준.

| 작업 유형 | 권장 phase 분해 |
|---|---|
| 신규 페이지 (UI) | ① 컴포넌트 신규 (`src/components/`) ② 페이지 통합 (`src/app/`) ③ 검증 |
| 신규 API 라우트 | ① service 메서드 (`src/services/`) ② route handler (`src/app/api/`) ③ 검증 |
| DB 스키마 변경 | ① schema (`src/infra/db/schema/`) + `pnpm db:generate` ② repository 메서드 ③ 검증 (`pnpm db:migrate:runtime`) |
| 마이그레이션 / GitHub 동기화 | ① `src/infra/github/` 또는 `src/services/SyncService.ts` ② 호출자 ③ 검증 + idempotency |
| 디자인 토큰 / 스타일 | ① `src/app/globals.css` 토큰 ② 컴포넌트 적용 ③ legacy grep + Lighthouse |

### 마지막 phase (검증 전용)

`fast` 실행 등급. `pnpm lint && pnpm type-check && pnpm build && pnpm test`, 잔재 grep, dead code 정리, JSON-LD 회귀, Lighthouse smoke.
**커밋은 별도 phase 로 분리하지 않는다** — build-with-teams 가 phase 단위 atomic commit 자동 생성.

## plan 네이밍 (번호 충돌 방지)

```bash
# cwd: <repo root>
ls tasks/ | grep "plan{후보번호}"
ls docs/adr/{후보번호}-*.md 2>/dev/null || echo "결번 없음"
gh pr list --state open --json number,headRefName,title --jq '.[] | "\(.headRefName) \(.title)"'
```

열린 PR 브랜치가 점유한 번호는 로컬 main 에 없어 놓치기 쉽다.
서브넘버 예: `plan160-treatment-settings-upgrade` → `plan160-2-conti-settings-upgrade`.

## branch / 커밋 / 핸드오프

- **branch**: `main`. PR 브랜치에서 작업 중이면 stash 후 main switch. 원격 protection 으로 차단 시 PR 경로 우회.
- **커밋**: docs 변경 + task 파일을 **한 커밋** 으로 묶는다.
- **핸드오프**: `/build-with-teams plan{N}` 로 구현 시작 안내.
