# common-critic-patterns

`build-with-teams`의 critic이 task 평가에서 **반복적으로 지적하는 패턴 모음**. plan/task 작성자(team-lead)는 사용자에게 task를 제출하기 **전**에 이 파일의 모든 패턴을 self-check하여 critic이 동일 지적을 반복하지 않도록 사전 소진한다.

이 파일은 **시간이 지날수록 두꺼워지고, critic이 할 말은 줄어드는** 살아있는 문서다. critic이 **새로운 타입**의 지적을 하면 세션 종료 후 이 파일에 패턴을 추가한다.

---

## 시드 패턴 (3 레포 공통)

webtoon-maker-v1에서 누적된 critic 지적 6 + 회귀 버그 분석에서 추출한 1 = 총 7 시드.

### P1. 수치 추측 금지

**Bad**: "약 30개 파일 수정 예정" / "줄 수 100줄 정도 줄어듦"
**Good**: `git diff --stat` 실측 인용

**Why**: critic이 가장 먼저 검증하는 것은 phase가 약속한 수치와 실제 코드 베이스의 일치 여부. 추측은 무조건 REVISE 사유.

**How to apply**: phase 작성 시 모든 수치(파일 수·줄 수·테스트 수·테이블 수)는 명령어로 검증한 결과만 인용. 명령어 자체를 phase 안에 남기면 critic이 재현 가능.

### P2. 파일 범위 부정확

**Bad**: "step2 컴포넌트 전체 수정"
**Good**: `git diff --name-only`로 본 정확한 파일 목록 (또는 phase 안에 `find ... -type f` 명령어 인용)

**Why**: "전체"라는 표현은 critic이 실제 범위를 추적할 수 없게 만든다. 누락 검증 불가능.

**How to apply**: phase의 작업 목록은 파일 경로 단위로 명시. 와일드카드를 쓰려면 명령어로 풀어 검증 가능하게.

### P3. 이전 plan/커밋 상호작용 누락

**Bad**: "X 기능을 추가한다" — 직전 plan과의 관계 무시
**Good**: "최근 10개 커밋(`git log --oneline -10` 인용) 중 plan{N-1}이 도입한 Y 구조를 전제로 X를 추가"

**Why**: 직전 plan이 만든 구조를 모르면 새 plan이 그 구조를 깨거나 중복 작업한다. critic은 main에서 최근 변경을 항상 확인하므로 곧바로 잡힌다.

**How to apply**: phase 컨텍스트 섹션에 최근 관련 커밋 목록을 인용. "이 task가 의존하는 직전 plan/PR" 명시.

### P4. 실행 컨텍스트 모호

**Bad**: `pnpm install` (어디서?)
**Good**: 모든 Bash 블록 위에 `# cwd: /Users/.../.claude/worktrees/{plan}` 주석

**Why**: worktree 환경에서 sub-agent가 main 워킹디렉토리에서 실행될 수 있다. cwd 모호하면 잘못된 위치에서 명령 실행 → 빌드 실패 또는 다른 plan 오염.

**How to apply**: phase의 모든 Bash 명령 위에 `# cwd:` 주석 강제. critic은 cwd 누락만 봐도 REVISE.

### P5. "눈으로 확인" 검증 금지

**Bad**: "구현 후 동작 확인", "UI 정상 표시 확인"
**Good**: 기계 명령만 (`grep -r 'pattern' src/`, `pnpm test --run`, `git diff --stat`)

**Why**: 사람의 "확인"은 phase가 자기완결적으로 검증할 수 없다. critic이 성공 기준을 재현 불가능.

**How to apply**: 성공 기준 섹션의 모든 항목을 grep/test/diff/build 명령으로 표현. 명령 + 기대 출력 명시.

### P6. 외부 상태 gate 부재

**Bad**: `git push origin main` (아무 상태 확인 없이)
**Good**: push/merge/comment 등 외부 동작 앞에 상태 확인 + 롤백 절차

**Why**: 원격 상태가 변했을 때 force push로 덮어쓰는 사고. PR/이슈 댓글이 잘못된 컨텍스트에 달리는 사고.

**How to apply**: push 전 `git fetch && git log --oneline @..origin/main` 확인 phase. 결과가 비어있지 않으면 `PHASE_BLOCKED`. comment·merge·release 같은 외부 동작도 동일 패턴.

### P7. 새 불변식 도입 시 모든 write 경로 가드 누락

**Bad**: 스키마에 `isDefault: Boolean` 추가 + 일부 경로에만 가드 + UI 가드 누락
**Good**: 새 불변식 도입 phase는 **4면 검사 체크리스트**를 성공 기준에 포함:
1. **Migration**: SQL 백필 + 인덱스 + 제약 (`@@unique` 등)
2. **Repository**: 모든 write 메서드(`create`/`update`/`delete`/`findOrCreate`)에 가드 (또는 동일 트랜잭션에서 보조 row 동시 생성)
3. **Mapper / DTO**: 입력 매퍼가 새 필드를 드랍하지 않는지 (`grep`으로 확인)
4. **UI**: 사용자가 불변식을 깨뜨릴 수 있는 액션(삭제 버튼·수정 폼)에 disable/throw

**Why**: webtoon-maker-v1 ultrareview에서 plan193 `CharacterSheet.isDefault` 도입이 5개 회귀 버그(bug_002·003·007·008·010) 발생. 모두 같은 불변식 위반의 다른 표면. 구체적으로:
- bug_007: mapper가 `isDefault` 드랍 → UI에서 만든 "기본" 시트가 `isDefault=false`로 저장
- bug_010: UI에 isDefault 시트 삭제 가드 없어 한 번 클릭으로 generation 영구 파손
- bug_002: write가 가드 전에 실행 → 가드 발동해도 phantom row commit
- bug_003: load-bearing 참조의 IO 실패가 silent fail-open

**How to apply**: 불변식이 load-bearing(다른 코드가 이 불변식을 가정하고 동작)이면, 4면 가드를 phase 작업 목록에 명시 항목으로 박는다. critic은 "load-bearing 불변식인가?" 질문을 우선 던진다.

---

## 레포별 +α 패턴 (Stage 0 시점 시드 — Stage 1에서 critic 실측으로 확장)

### frontend-fos (Next.js 16 / React 19)

**FE1. App Router 경계 위반**
- `actions/`(use server)가 `lib/server/api`를 거치지 않고 `fetch`를 직접 호출하는지 grep: `grep -rn "fetch(" src/actions/`
- `services/`가 `revalidatePath`/`requireAuth`를 호출하면 위반

**FE2. Shadcn 우회**
- native `<button>`/`<select>`/`<dialog>`를 컴포넌트에 직접 사용하는지 grep
- 인라인 overlay 모달이 `Dialog`/`AlertDialog` 대신 `<div>`로 구현되어 있는지

**FE3. revalidatePath 누락**
- write Server Action이 데이터 변경 후 `revalidatePath`를 호출하지 않으면 stale UI

### backend-fos (Spring Boot 4 / Java 21 / Gradle)

**BE1. `@Transactional` 경계 누락**
- write Service 메서드가 `@Transactional` 없이 여러 repository 호출 → 부분 커밋 위험
- 클래스 레벨 `@Transactional(readOnly = true)` 기본 + write 메서드만 `@Transactional` 명시

**BE2. Entity-DTO 노출**
- Controller가 `@Entity`를 직접 응답으로 반환 (lazy loading 익셉션 + 무한 직렬화)
- Response DTO + `static from(Entity)` 패턴 강제

**BE3. AOP 자기호출 우회**
- 같은 클래스 내에서 `@CacheEvict`/`@Transactional` 메서드를 자기 호출 → AOP 프록시 우회로 무효
- 외부 호출만 어노테이션 적용 가능, 자기 호출은 `CacheManager` 직접 사용

### dooray-cli (TypeScript / Commander.js / tsup)

**CLI1. exitCode 누락**
- 에러 분기에서 `process.exit(N)` 또는 `throw new DoorayCliError(msg, exitCode)` 호출 누락 → 0으로 종료되어 호출 스크립트가 실패 인지 못함

**CLI2. ky 외 HTTP 클라이언트 사용**
- `axios`/`node-fetch`/`got` import → 번들 크기 증가 + 일관성 위반

**CLI3. 캐시 일관성**
- `~/.dooray/cache/` 쓰기 후 읽기 일관성: write는 atomic(`writeFile` to temp + rename), read는 schema 검증 (Zod 등)

### fos-blog (Next.js 16 / Drizzle ORM / MySQL / pino)

**BLG1. Drizzle `db:push` 금지**
- `drizzle-kit push`는 마이그레이션 이력을 남기지 않는다 → 홈서버 프로덕션 배포 시 스키마 drift 유발
- **Good**: `pnpm db:generate` (SQL 파일 생성) → git 커밋 → `pnpm db:migrate` (apply). 스키마 변경은 반드시 마이그레이션 파일 동반
- 예외: 로컬 실험용 `db:push`는 `.env.local`/개발 DB에서만, 커밋 전 revert

**BLG2. pino 구조화 로그 컨텍스트 누락**
- `logger.error("sync failed")` 같이 메시지만 남기기 금지
- **Good**: `logger.error({ component: "GithubSync", operation: "fetchFiles", owner, repo, err }, "failed to fetch files")` — 최소 `{component, operation, ...domainContext, err}` 4-field
- **Why**: 프로덕션에서 JSON 로그를 grep/filter할 때 구조화 필드가 없으면 추적 불가. `src/lib/logger.ts` 컨벤션 준수

**BLG3. GitHub sync 사일런트 실패**
- Octokit(`@octokit/rest`) 호출을 `try { ... } catch { return null }`로 삼켜서 UI에 "no posts"가 뜨는 사고 금지
- **Good**: 구조화 로그(`logger.error(...)`) + 상위로 throw 또는 명시적 에러 상태(`SyncResult.failure`) 반환. sync API route는 500 + 에러 body로 응답
- **Why**: `fos-study` repo가 rate-limit 또는 auth 만료 시 디버깅 불가

**BLG4. Markdown 렌더 XSS 회피**
- `react-markdown` + `rehype-raw` 조합은 raw HTML 허용. 외부 출처 마크다운(`fos-study` repo)에 스크립트/iframe이 섞일 가능성
- **Good**: `rehype-sanitize` 동반 사용, 또는 source repo가 자기 소유임을 근거로 rehype-raw 사용 명시 주석 + PR에서 확인

**BLG5. Next.js 16 proxy 규약** (NJS15 mental model 잔재 방지)
- `src/proxy.ts` = NJS16 정식 file convention (구 `middleware.ts`). root `middleware.ts` 추가 권장 금지
- `runtime: "nodejs"` config 명시 금지 — proxy 는 Node 고정이고 config 키 자체가 빌드 에러
- `middleware-manifest.json` 비었다고 dead code 판단 금지 (NJS16 manifest 이름 다름)
- 의문 시 https://nextjs.org/docs/app/api-reference/file-conventions/proxy 확인

---

### P8. 마지막 phase 에 index.json `completed` 마킹 지시 누락 (webtoon-maker-v1 이식)

**Bad**: task 파일 작성 시 phase 별 작업만 명시. 마지막 phase 본문에 `tasks/{plan}/index.json` 의 status + 모든 phase status 를 `"completed"` 로 갱신하라는 지시 부재.
**Good**: 마지막 phase 작업 목록에 명시:
```bash
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/{plan}/index.json
grep -c '"status": "completed"' tasks/{plan}/index.json   # = (1 + total_phases)
```
**Why**: executor 가 scope 가드 준수로 자체 추가 안 함 (올바른 행동). 누락 시 team-lead 가 PR 직전 amend 또는 별도 commit 으로 사후 처리 → 단일 commit 패턴 깨지고 main 직접 수정 유혹 발생. fos-blog 본 plan007-2 / plan013 모두 이 사고 회피 위해 작업 5d / 마지막 작업 명시했음.
**How to apply**: task 작성 후 grep 으로 검증: `grep -lE "index\.json.*completed" tasks/{plan}/phase-*.md` 가 마지막 phase 파일과 매칭되는지.

### P9. macOS BSD `sed` `\b` 미지원 (webtoon-maker-v1 이식)

**Bad**: rename 작업에 `sed -i '' 's|foo\b|bar|g'`. macOS BSD sed 는 `\b` word boundary 미지원 → 0 매치.
검증: `echo "x.contentReview.y" | sed 's|contentReview\b|X|g'` → 변경 없음.
**Good**: `perl -i -pe 's/\bfoo\b/bar/g' file.ts` (perl `\b` 정상). compound 식별자도 함께 rename 필요시 boundary 없이 substring 매치 (`s/foo/bar/g`), boundary 보호 식별자만 `\b` 명시.
**Why**: silent 회귀 — 빌드/타입 체크가 잡지만 phase 본문은 통과로 보일 수 있음. 검증 grep 도 `[^W]` 같은 negated class 회피 (word char 까지 매치되어 false fail). `rg '\bfoo\b'` 사용. `rg --include` 미지원 → `-g '*.ts' -g '*.tsx'`.
**How to apply**: rename plan 의 sed `\b` 사용 시 → perl 교체 + 검증식도 `\b` 사용 일관성.

---

## 패턴 소진 체크리스트 (plan 제출 전 최종 확인)

task 파일 작성이 끝났다고 판단되면, 사용자 제출 전 critic 게이트 통과를 위해 아래 전부 확인:

- [ ] **P1**: 모든 수치(파일 수·줄 수·테스트 수)가 `git diff --stat` 등 실측 명령 결과
- [ ] **P2**: 파일 목록이 `--name-only` 결과와 일치, 와일드카드 풀어 명시
- [ ] **P3**: 최근 10개 main 커밋과의 관계 서술 (없으면 "없음" 명시)
- [ ] **P4**: 모든 Bash 블록 위에 `# cwd: ...` 주석. worktree 사용 plan 은 main vs worktree 명확
- [ ] **P5**: 성공 기준에 "확인", "검토" 같은 인간 의존 문구 0건. 모두 grep/test/diff/build
- [ ] **P6**: push/merge/comment 등 외부 동작 앞에 상태 gate + 롤백 절차
- [ ] **P7**: load-bearing 불변식 도입 시 4면 가드 (Migration / Repository / Mapper / UI) 명시
- [ ] **P8**: 마지막 phase 에 index.json `"status": "completed"` 마킹 + grep 검증
- [ ] **P9**: rename 시 macOS sed `\b` 사용 안 함 (perl 또는 substring)

---

## 패턴 추가 규칙

critic이 **새로운 타입**의 지적(P1~P9 또는 레포별 +α 어디에도 해당 안 됨)을 하면:

1. 세션 종료 후 이 파일 적절한 섹션에 추가
2. 형식: **Bad / Good / Why / How to apply** 4-section
3. **Why**에 "어떤 plan/PR에서 발견" 명시 (역추적 가능)
4. 추가된 패턴은 다음 plan의 self-check에 포함

이 파일은 3 레포에서 동기화된다 (Stage 2 합류 시). 레포 고유 패턴은 +α 섹션에만 추가.
