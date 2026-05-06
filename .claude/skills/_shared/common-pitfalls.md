# Common Pitfalls

skills 가 공유하는 사고 / 실수 회피 패턴. 카테고리별로 호출 시점이 다르므로 필요한 § 만 grep 해서 참조.

| § | 카테고리 | 호출 시점 | 사용 스킬 |
|---|---|---|---|
| § 1 | plan 작성 (critic 회피) | task 파일 작성 직후 self-check | `planning`, `build-with-teams` |
| § 2 | team 운영 | 팀원 스폰 / 메시지 / 브랜치 작업 시 | `build-with-teams` |
| § 3 | PR review 학습 (코드 패턴 함정) | 리뷰 댓글 처리 후 누적 | `review-fix` |
| § 4 | 레포별 +α | task 도메인 코드 작성 시 | `planning`, `build-with-teams` |

## 축적 규칙

- 새로운 사고 타입 발견 시 해당 § 에 **패턴 한 줄 + 실측 명령 + self-check** 추가
- 같은 사고 재발 시 패턴 강화 (예시 / 체크 엄격화)
- "왜 이 가드가 필요한지" 1줄 단서는 반드시 — 미래 AI 가 의도 모르고 우회하지 않도록
- 사고 사례 (plan###) 는 1개로 충분, 복수 나열 금지

---

# § 1. plan 작성 (critic 회피)

`/planning` 또는 `build-with-teams` 가 task 파일 작성 시 self-check. 이 § 의 모든 항목을 plan 생성 **전에 소진** 하면 critic 이 1-shot APPROVE 할 확률이 높다.

## 1-1. 수치 추측 (파일 수 / 줄 수)

**증상**: "약 30개 파일", "100줄 줄어듦" 같은 수치를 실측 없이 적음.
**왜**: critic 이 가장 먼저 검증하는 것은 phase 약속 수치 ↔ 실제 코드 일치 여부. 추측은 즉시 REVISE 사유.

```bash
git diff <base>..<target> --stat | tail -5
git diff <base>..<target> --name-only | wc -l
```

**Self-check**: 모든 수치가 실측 명령 결과? 명령 자체가 plan 에 인용되어 있는가?

## 1-2. 파일 범위 부정확

**증상**: "step2 컴포넌트 전체 수정" — "전체" 표현은 critic 이 추적 불가.
**왜**: 누락된 파일이 conflict 진앙이 되면 executor 가 헤맨다.

```bash
git diff <base>..<target> --name-only -- <scope-dir>/
```

**Self-check**: 파일 목록을 plan 에 전부 나열했고, 각 파일 처리 원칙이 서술됐는가?

## 1-3. 이전 plan / main 커밋과의 상호작용 누락

**증상**: 이번 plan 이 다른 최근 plan 산출물과 충돌하는데 본문에 그 관계 미서술.
**왜**: executor 가 rebase 중 "어느 쪽이 final state 인가" 모르고 잘못된 방향으로 병합.

```bash
git log origin/main --oneline -20 -- <scope-dir>/
ls -dt tasks/plan*/ | head -5
```

**Self-check**: 최근 10개 커밋 중 plan 범위 파일을 건드린 게 있는가? 있으면 "어느 쪽이 final" 명시?

## 1-4. 실행 컨텍스트 모호 (cwd / branch)

**증상**: Bash 블록에 `cd` 없거나 "메인 디렉터리에서" 같은 애매한 서술.
**왜**: worktree 에서 main repo 로 잘못 커밋이 박히면 force-push 로 PR 에 섞임.

**규칙**: 모든 Bash 블록 위에 `# cwd: {절대경로}` 주석 + 브랜치 의존 시 `# branch: {expected}`.

**Self-check**: 모든 Bash 블록이 실행 위치 명시? worktree 사용 plan 이면 main vs worktree 구분 명확?

## 1-5. "눈으로 확인" 검증

**증상**: 성공 기준에 "수동 검토", "눈으로 확인" 같은 인간 의존 문구.
**왜**: executor (LLM) 가 "확인했다" 단정 가능 → 사실상 검증 없음.

**규칙**: 성공 기준의 각 항목은 grep / test / diff + 기대값 (건수 / exit / 문자열 포함) 명시.

**Self-check**: "확인" / "검토" 문구 0건? 각 명령에 기대값 명시?

## 1-6. 외부 상태 gate 부재

**증상**: 외부 시스템 변경 (push, merge, PR comment, 배포) 단계 앞에 상태 확인 명령 없음.
**왜**: PR 이 close / merge 됐는데 force-push 하거나 CI 실패 모르고 "검증 완료" 댓글.

```bash
STATE=$(gh pr view {N} --json state -q .state)
[ "$STATE" = "OPEN" ] || { echo "PR is $STATE"; exit 1; }
```

**Self-check**: 외부 가시 동작 앞에 gate, 뒤에 rollback 절차?

## 1-7. 새 불변식 도입 시 4면 가드 누락

**증상**: 스키마에 `isDefault: Boolean` 추가 + 일부 경로에만 가드 + UI 가드 누락.
**왜**: 같은 불변식이 다른 표면에서 깨짐 (mapper 드랍 / UI 삭제 / 트랜잭션 분리 등).

**4면 검사 체크리스트** (load-bearing 불변식인 경우 필수):
1. **Migration**: SQL 백필 + 인덱스 + 제약
2. **Repository**: 모든 write 메서드 (`create` / `update` / `delete` / `findOrCreate`) 가드
3. **Mapper / DTO**: 입력 매퍼가 새 필드를 드랍하지 않는지 (`grep` 확인)
4. **UI**: 사용자가 불변식을 깨뜨릴 수 있는 액션 (삭제 / 수정 폼) 에 disable / throw

**Self-check**: load-bearing 불변식 도입 시 4면 가드 모두 phase 작업 목록에 명시?

## 1-8. 마지막 phase 에 index.json `completed` 마킹 지시 누락

**증상**: 마지막 phase 본문에 "index.json status + 모든 phase status 를 `completed` 로 + 단일 commit 포함" 지시 없음.
**왜**: executor 는 scope 가드로 자체 추가 안 함 (올바른 행동) → team-lead 가 PR 직전 amend / 별도 commit. main 직접 수정 유혹 발생.

```bash
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/{plan}/index.json
grep -c '"status": "completed"' tasks/{plan}/index.json   # = (1 + total_phases)
grep -lE "index\.json.*completed" tasks/{plan}/phase-*.md   # 마지막 phase 파일 매칭
```

**Self-check**: 마지막 phase 에 마킹 지시 + 단일 commit 포함 명시?

## 1-9. macOS BSD `sed` `\b` 미지원

**증상**: rename plan 에 `sed -i '' 's|foo\b|bar|g'`. macOS BSD `sed` 는 `\b` 미지원 → 0 매치.
검증: `echo "x.contentReview.y" | sed 's|contentReview\b|X|g'` → 변경 없음.
**왜**: 핵심 치환 누락, 빌드 / 타입 검증 실패하지만 phase 본문은 통과로 보일 수 있음.

**대체**: `perl -i -pe 's/\bfoo\b/bar/g'`. 검증식도 `rg '\bfoo\b'`. `rg` 는 `-g '*.ts' -g '*.tsx'` 사용 (`--include` 미지원).

**Self-check**: rename plan 에서 sed `\b` → perl 교체? 검증식 일관성?

## § 1 소진 체크리스트

plan 제출 전 9개 패턴 모두 self-check:

- [ ] **1-1**: 모든 수치가 실측 명령 결과
- [ ] **1-2**: 파일 목록이 `--name-only` 결과와 일치
- [ ] **1-3**: 최근 10개 커밋과 이 plan 의 관계 서술
- [ ] **1-4**: 모든 Bash 블록에 `# cwd:` 주석
- [ ] **1-5**: 성공 기준에 인간 의존 문구 없음
- [ ] **1-6**: 외부 상태 변경 단계에 gate + rollback
- [ ] **1-7**: load-bearing 불변식 도입 시 4면 가드
- [ ] **1-8**: 마지막 phase 에 index.json `completed` 마킹 지시
- [ ] **1-9**: rename 시 `sed \b` 대신 `perl`

---

# § 2. team 운영

`build-with-teams` 가 팀원 스폰 / 메시지 / 브랜치 작업 시 self-check. 사고가 자주 발생하는 영역.

## 2-1. 팀원 SendMessage 회신 누락

**증상**: sub-agent 가 평가 결론을 자기 화면에만 출력하고 종료. team-lead inbox 미도달.
**왜**: idle 알림만 도착 → team-lead 평가 미수신 상태로 다음 단계 진행 불가.

스폰 프롬프트 + 작업 지시 메시지 양쪽에:
```
회신은 반드시 SendMessage 로 team-lead 에 송신.
화면 텍스트만 출력하고 종료 시 라우팅 안 됨.
```

team-lead 가 idle 알림 2회 연속 + 평가 메시지 0 → 즉시 강제 재요청.

## 2-2. 팀원 자발적 실행

**증상**: idle 대기 지시 무시하고 team-lead 의 SendMessage 전에 자발 실행 / 검증 시작.
**왜**: critic 게이트 시점 정합성 망가짐.

스폰 프롬프트에:
```
team-lead 의 명시적 "시작" 지시 전 절대 자발 실행 금지. idle 유지.
```

team-lead 는 critic 평가 중 worktree git status 점검으로 자발 실행 조기 감지.

## 2-3. self-shutdown 패턴 (fos-blog 관측)

**증상**: `oh-my-claudecode:code-reviewer` / `architect` (docs-verifier) 가 `run_in_background: true` 로 스폰해도 idle 직후 자체 shutdown.
**왜**: critic 만 idle 유지 성공. reviewer / verifier 는 shutdown.

**우회**: 검사 결과 준비 시점에 즉시 새로 spawn (idle 대기 의존 금지). 죽었다는 시스템 알림 받으면 침묵 말고 새로 스폰 + 즉시 검사 지시 묶음.

## 2-4. executor cwd 격리 (main repo 오염 방지)

**증상**: worktree 절대경로 명시했는데 executor 가 main repo 에서 `cd /main-repo` 로 작업.
**왜**: main 오염 → origin 다이버전스 / 다른 plan 미푸시 작업과 충돌.

executor 프롬프트에:
```
모든 cd / git / 파일 편집은 worktree 절대경로 기준만. main repo 직접 cd 금지.
의심 시 `pwd` 확인.
```

team-lead 는 executor 작업 중 `git -C {main-repo} status` 주기 점검. dirty 시 즉시 중단.

## 2-5. executor scope 확장 자체 판단

**증상**: phase 도중 task 범위 외 (pre-existing 에러 / 발견한 bug / ADR 위반 자체 변경) 를 자체 추가. 또는 `eslint-disable` / `@ts-ignore` 자체 추가.
**왜**: critic 게이트 우회 → 사후 평가 사이클 추가 + task 본문 / 성공 기준 어긋남.

executor 프롬프트에:
```
task 범위 외 수정은 자체 판단 금지.
eslint-disable / @ts-ignore / @ts-nocheck / @ts-expect-error 자체 추가 = 정책 변경 → 보고 필수.
SendMessage 로 team-lead 에 보고: "X 발견, Y 수정 필요. 본 phase 포함 / 별도 plan 결정 부탁".
```

team-lead 흐름: 보고 → critic 사후 평가 → ACCEPT (scope 확장 commit 명시) 또는 REJECT (별도 plan).

## 2-6. critic v2 재평가 시 신 파일 미재읽기

**증상**: REVISE 후 v2 commit hash 받고도 v1 평가 그대로 반복 송신.
**왜**: critic 이 이전 평가 컨텍스트만 가지고 회신 → 신 파일 Read 누락.

team-lead 재평가 메시지에 **3가지 필수 포함**:
1. `Read tool 로 다음 파일을 다시 읽고 재평가해 줘` 명시 + 변경 파일 절대경로
2. 4-5개 확인 포인트 체크리스트
3. "직전 메시지가 첫 평가 사본일 수 있음 — 실제 파일 상태 기준으로 판정"

회신이 v1 동일하면 즉시 강제 재읽기.

## 2-7. code-reviewer 에 plan 비자명 설계 결정 미전달

**증상**: code-reviewer 가 plan 컨텍스트 모르면 정상 helper 사용을 권장하다 설계 의도와 충돌 (false positive LOW 양산).
**왜**: team-lead 가 일일이 판정해야 함.

team-lead 의 검사 시작 메시지에 plan 의 비자명 결정 (helper 우회 사유 / 의도된 raw pattern / 의도된 placeholder 등) 1-2 줄 첨부.

## 2-8. task 재분할 시 index.json 갱신 누락

**증상**: critic REVISE 후 phase 파일 재작성 / 추가 / 제거 시 `index.json.total_phases` + `phases` 배열 미갱신.
**왜**: 파이프라인이 신 phase 인식 못 해 executor 가 구 phase 만 실행 → plan 핵심 누락.

```bash
jq -r '.total_phases as $t | .phases | length as $p | "total=\($t), len=\($p)"' tasks/{plan}/index.json
ls tasks/{plan}/phase-*.md | wc -l   # 위 두 값과 일치
```

phase 파일과 index.json 은 같은 commit 으로 갱신.

## 2-9. cwd 추적 + 양쪽 git status 검증

**증상**: team-lead 가 task 재작성 / commit 시 cwd 가 main repo 인지 worktree 인지 헷갈림. 동일 상대경로가 다른 파일 가리킴.
**왜**: main repo 의 task 파일 의도치 않게 수정 / 삭제. system-reminder 알림이 어느 working tree 인지 명확히 표기 안 됨.

commit 전 `pwd` + 양쪽 동시 점검:
```bash
git -C /Users/.../fos-blog status --short
git -C /Users/.../fos-blog/.claude/worktrees/{plan} status --short
```

## 2-10. 브랜치 확인 누락 commit 사고

**증상**: skill / docs 변경 commit 직전 `git branch --show-current` 안 함 → PR 작업 브랜치에 무관 commit 박힘.
**왜**: skill 외부 작업이라도 자동 mode 가 자동 switch 하는 듯. 같은 세션 두 번 발생.

**규칙**: 모든 commit 직전 `git branch --show-current` 강제 확인. main 작업이면 main, PR 브랜치 작업이면 PR 브랜치 확인 후 commit.

## § 2 소진 체크리스트

스폰 / 메시지 / 검증 / commit 단계마다 해당 패턴 self-check.

---

# § 3. PR review 학습 (코드 패턴 함정)

`review-fix` 가 PR 리뷰 댓글 처리 후 재발 가능 패턴을 누적하는 자리. 같은 지적이 다음 PR 에서 반복되지 않도록.

## 3-1. Drizzle `count(*)` 의 `sql<T>` 타입 부정확 (PR #81)

**증상**: `sql<number>\`count(*)\`` 선언. MySQL `COUNT(*)` 는 BigInt-safe 위해 string 반환 → 런타임 ↔ TypeScript 타입 불일치.
**Good**: `sql<string>\`count(*)\`` + 호출처 `Number(result[0]?.count ?? 0)`. 또는 Drizzle `count()` helper.
**검출**: `grep -nE "sql<number>\`count" src/infra/db/`

## 3-2. SVG `<stop>` 의 `stopColor="var(--...)"` 미해결 (plan013)

**증상**: SVG presentation attribute 는 CSS context 가 아니라 var() 해석 안 됨 → stop 이 default 색 (검정 / 투명) 으로 떨어짐 → mesh 시각적으로 사라짐.
**Good**: `<stop style={{ stopColor: "var(--mesh-stop-XX)", stopOpacity: 0.4 }} />` inline style (CSS property context). 또는 globals.css 에 `.mesh-layer-N stop:first-child { stop-color: var(--token) }`.
**검출**: `! grep -nE 'stopColor="var\(' src/components/*.tsx`

## 3-3. CSS custom property 키는 `as CSSProperties` 단언 필요 (PR #81)

**증상**: `style={{ "--my-var": value }}` 가 `Properties<>` 인덱스에 없는 키라 type-check 실패 (TS2353).
**Good**: `as CSSProperties` 단언은 그대로 유지. 단 값 부분에 number 직접 넣지 말고 `String(num)` 명시 변환으로 의도 명확화.
**Why**: claude bot 이 "단언 제거" 권장하기 쉽지만 custom property 키 자체가 단언 원인이라 제거 불가. 값 변환만이 의미 있음.

## 3-4. inline `style={{ color: ... }}` vs Tailwind arbitrary class (PR #81)

**증상**: 토큰 var() 적용에 `style={{ color: "var(--token)" }}` 사용.
**Good**: 단일 색상 / 크기 / 길이 토큰은 `className="text-[var(--token)]"` arbitrary class (프로젝트 관례). 다중 CSS property 또는 동적 계산 필요할 때만 inline style.
**예외**: SVG presentation attribute var() 미해결 우회 (3-2) 같은 경우 inline style 정당.

## 3-5. 라이트 모드 selector — mockup 잔재 금지 (plan013)

**증상**: mockup (Claude Design 등) 의 가상 클래스 (`.ab.light`) 가 코드에 그대로 들어감 → 룰 미적용.
**Good**: 프로젝트 룰 — ThemeToggle 이 `.dark` class 를 토글 → 라이트 모드 selector 는 `:root:not(.dark)` 만 유효.
**검출**: `! grep -nE '\.ab\.light\b' src/app/globals.css`

## 3-6. silent 테스트 회귀 (plan007-2)

**증상**: 우회 정책 (rate-limit bypass) 확장 시, 기존 테스트가 사용하던 IP / UA 가 새 우회 대상으로 흡수되어 테스트는 통과하지만 검증 의미가 사라짐.
**Good**: 우회 도입 plan 은 항상 기존 테스트 입력값 점검. 예: rate-limit bypass 에 RFC1918 추가 시 sweep test IP 를 `10.x.x.x` → `100.64.x.x` (CGN 대역) 변경.
**검출**: 테스트 입력값 grep 으로 우회 대상 포함 여부 확인.

## 3-7. `passNode: true` 누락 — hast-util-to-jsx-runtime default false (PR #83)

**증상**: `toJsxRuntime(tree, { Fragment, jsx, jsxs, components })` 만 쓰고 `passNode` 미명시. default 가 false 라서 components 핸들러의 `node` prop 이 모두 undefined → `node?.properties?.[...]` / `node?.tagName` 검사 코드 모두 무력화 → 코드블록 frame / mermaid 분기 / data-attribute 검사 silent 깨짐.
**Good**: `toJsxRuntime(tree, { ..., passNode: true, components })`.
**검출**: `grep -nE 'toJsxRuntime\(' src/ | xargs -I{} grep -L "passNode" {}` 가 비어 있어야 함. unified hast 트리 → React 변환 시 컴포넌트가 hast `node` 검사하면 무조건 명시.

## 3-8. server-only 가드 + vitest node 환경 충돌 (PR #83)

**증상**: `import "server-only"` 가드 모듈을 vitest 의 node 환경 (`environment: "node"`) 에서 직접 import 하면 throw. Next.js RSC 의 react-server condition 미적용 환경이라 server-only 패키지가 client import 로 오인 → 모든 테스트 즉시 실패.
**Good**: 테스트 파일 상단에 `vi.mock("server-only", () => ({}))` 1줄 추가. 가드는 production 빌드에서만 의미 있고 vitest 는 우회.
**검출**: `grep -l 'import "server-only"' src/` 결과 모듈을 import 하는 test 파일이 `vi.mock("server-only"` 도 포함하는지 cross-check.

## 3-9. non-null assertion (`!`) 대신 타입 가드 (PR #83)

**증상**: `if (isRelativeMd && basePath)` 안에서 `resolveMarkdownLink(href!, basePath)` 처럼 `!` 사용. `isRelativeMd` 가 true 면 href 가 non-null 임이 논리적 보장이지만 TS 가 추론 못 함. 안전성 우회 + lint 경고 가능.
**Good**: 조건문에 `&& href` 추가해 3-way 타입 가드로 좁히기 — `if (isRelativeMd && basePath && href)` 후 `resolveMarkdownLink(href, basePath)`.
**검출**: `grep -rn '![\\s]*,' src/components/markdown/` 등 비slash 위치의 `!` 점검.

## 3-10. derived counter 를 매 iter 재계산 (O(n²)) (PR #103)

**증상**: `toc.map((item, idx) => ... toc.slice(0, idx+1).filter(t => t.level === 2).length ...)` 처럼 누산값을 map iter 안에서 slice + filter 로 다시 계산. 항목 수가 적어 실측 영향은 미미해도 **자매 컴포넌트가 단순 증분 (`let h2Counter = 0; if (!isH3) h2Counter++`) 을 쓰면 일관성 깨짐**.
**Good**: map 바깥에 누산 변수 선언 + iter 안에서 `++`. React 함수 컴포넌트 안의 `let` 누산은 매 렌더 새로 초기화되므로 안전.
**검출**: `grep -rn 'slice(0, idx' src/components/` — pagination 외 위치에 등장 시 의심.

## 3-11. client component catch 의 console.error 만 두면 UX 침묵 (PR #105)

**증상**: fetch / mutation 의 catch 블록에서 `console.error("X failed:", error)` 만 호출하고 결과 영역은 비우거나 빈 결과로 fallback. 사용자는 "결과 없음" 으로 오해 (실제로는 네트워크/서버 에러).
**Good**: `errorState: string | null` state 추가 → catch 에서 setError → UI 의 결과 영역에 빈 결과와 별개 분기로 표시. 새 요청 시작 시 reset (`setError(null)`). server-side 응답이 ok 가 아닐 때도 throw 하여 catch 로 라우팅 (`if (!response.ok) throw ...`).
**검출**: `grep -rn 'console.error.*failed' src/components/` — client component 의 catch 안 console.error 호출이 사용자 피드백 state 없이 단독 사용되면 재발 가능.

## 3-12. useRef array 가 source 변경 시 stale 잔존 (PR #105)

**증상**: `const refs = useRef<(T | null)[]>([])` 로 N 개 항목의 DOM ref 를 모으는데, `items` 가 새 배열로 교체된 후 `refs.current` 가 이전 길이 그대로 남아 hover/scroll 등 후속 effect 가 stale element 를 가리킴.
**Good**: items 변경 시 ref 배열을 trim 하는 effect 명시.
```ts
useEffect(() => {
  refs.current = refs.current.slice(0, items.length);
}, [items]);
```
**검출**: `grep -rn 'useRef<.*\[\]>' src/components/` 로 ref array 후보를 찾고, 같은 컴포넌트에서 items state 가 자주 교체되는데 위 trim effect 가 없으면 의심.

## 3-13. npm dep 제거 전 globals.css / config 의 직접 참조 grep 누락 (PR #107)

**증상**: package.json 에서 npm dep 가 "코드에서 직접 import 안 보임" 이라는 이유로 제거. 실제로는 `src/app/globals.css` 의 `@import "pkg/dist/.../style.css"`, `tailwind.config`, `tsconfig paths`, `next.config` 같은 비-TS 진입점이 그 dep 를 의존하던 케이스 → turbopack/webpack 빌드 단계에서 resolve 실패. 단위 테스트는 통과하지만 build 가 깨진다 (PR #107 의 pretendard 가 "OG 폰트 static asset" 으로 오해되어 제거된 사례).
**Good**: dep 제거 전 아래 grep 모두 0건이어야 안전:
```bash
grep -rn "<pkg-name>" src/app/globals.css src/app/*.css tailwind.config.* next.config.* tsconfig.json postcss.config.* eslint.config.*
grep -rn "from ['\"]<pkg-name>" src/ scripts/
```
**Why**: TS import 만 보면 CSS / config 의존을 놓친다. fos-blog 의 `pretendard` 처럼 "UI 폰트 CSS import + OG 폰트 자산" 처럼 한 dep 가 두 용도일 때 위험.

## 3-14. hex 입력 string 을 parseInt 로 분해할 때 형식 검증 누락 (PR #107)

**증상**: `parseInt(hex.slice(1, 3), 16)` 로 RGB 분해. 짧은 hex (`#abc`) / 빈 문자열 / 비-hex 문자열 입력 시 `parseInt` 가 NaN 반환 → `rgba(NaN, NaN, NaN, alpha)` 같은 무효 CSS 생성. satori / canvas / CSS 어디든 silent 실패.
**Good**: `^#[0-9a-fA-F]{6}$` 패턴 검증 후 비매치 시 안전한 fallback rgba 반환.
```ts
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
function hexWithAlpha(hex: string, alpha: number): string {
  if (!HEX_PATTERN.test(hex)) return `rgba(63, 186, 201, ${alpha})`; // brand fallback
  // ... parseInt 분해
}
```
**검출**: `grep -rn 'parseInt.*16)' src/lib/` 로 hex 분해 후보 찾고, 함수 진입에 정규식 / length 가드 없으면 의심. 외부 입력 경로 (URL param / form / props) 가 닿는지 확인.

## 3-15. react-hook-form + zod 의 create/edit 모드 schema 미분리 (PR #108)

**증상**: 단일 zod schema 가 모든 필드 required 인데 edit 모드는 일부 필드만 입력 (예: `password` + `content` 만, `nickname` 은 read-only) → form 제출 시 누락 필드 validation 오류 발생.
**Good**: `createSchema.pick({ ... })` 또는 `omit` 으로 mode 별 schema 분리 + props 를 discriminated union (`mode: "create" | "edit"`) 으로 강제. `useForm` resolver 가 mode 에 따라 분기.
```ts
const createSchema = z.object({ nickname, password, content });
const editSchema = createSchema.pick({ password: true, content: true });
const resolver = zodResolver(mode === "edit" ? editSchema : createSchema);
```
**검출**: `grep -rn 'zodResolver' src/components/` + 같은 컴포넌트가 `mode: "create" | "edit"` props 받으면서 schema 1개만 쓰면 의심.

## 3-16. 서버 raw error 메시지를 클라이언트 toast 로 직접 노출 (PR #108)

**증상**: `catch (error) { toast.error(error.message) }` 또는 `toast.error(data.message)` 로 서버 응답 메시지를 그대로 화면에 표시. SQL 구문 / 스택 / 내부 식별자 / DB 컬럼명 노출 위험.
**Good**: 사용자 친화 일반 메시지만 toast, 상세는 콘솔 로그. 4xx 에서 의미 있는 코드는 화이트리스트 매핑.
```ts
const USER_FRIENDLY_ERRORS: Record<string, string> = {
  PASSWORD_MISMATCH: "비밀번호가 일치하지 않습니다",
};
toast.error(USER_FRIENDLY_ERRORS[code] ?? "요청을 처리할 수 없습니다");
```
**검출**: `grep -rn 'toast.error.*\(error\|err\|data\)\.' src/components/` — error / data 의 message 필드를 toast 직접 전달이면 의심.

## 3-17. Drizzle timestamp 컬럼이 API 응답 후 ISO string 직렬화 (PR #108)

**증상**: 서버에서 Drizzle `comments.createdAt: timestamp` 가 `Date` 객체로 보이지만, `Response.json()` / `JSON.stringify` 직렬화 후 클라이언트는 ISO string 으로 받음. client 측 `(date: Date)` 시그니처 헬퍼에 넘기면 `date.getTime is not a function` 또는 런타임 NaN.
**Good**: 클라이언트 시간 헬퍼는 `Date | string` 양쪽 수용 + invalid 가드.
```ts
function formatRelativeTime(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "";
  // ...
}
```
**검출**: `grep -rn 'createdAt\|updatedAt' src/components/` 후 Date 메서드 (`getTime()` / `toLocaleDateString()`) 직접 호출이 있으면 ISO string 케이스 처리 여부 확인.

## § 3 누적 규칙

- `review-fix` 6.5단계에서 추출. 같은 PR 에서 ✅ 누적 / ❌ 누적 금지 분류 후 § 3 추가
- ✅ 재현 가능 패턴 — 같은 실수가 다른 코드에서도 발생 가능. 명령으로 검출 가능
- ❌ 1회성 / 특정 plan 컨텍스트에서만 의미 / 칭찬 / 단순 확인 요청

---

# § 4. 레포별 +α 패턴 (Stage 0 시드)

레포 도메인 코드 작성 시 critic 이 추가로 검사하는 항목. 3 레포 (frontend-fos / backend-fos / dooray-cli / fos-blog) 동기화 시 공유.

### frontend-fos (Next.js 16 / React 19)

- **FE1. App Router 경계 위반**: `actions/` 가 `lib/server/api` 거치지 않고 `fetch` 직접 호출. `services/` 가 `revalidatePath` / `requireAuth` 호출.
- **FE2. Shadcn 우회**: native `<button>` / `<select>` / `<dialog>` 직접 사용. 인라인 overlay 모달이 `Dialog` / `AlertDialog` 대신 `<div>`.
- **FE3. revalidatePath 누락**: write Server Action 데이터 변경 후 누락 → stale UI.

### backend-fos (Spring Boot 4 / Java 21 / Gradle)

- **BE1. `@Transactional` 경계 누락**: write Service 가 여러 repository 호출 → 부분 커밋.
- **BE2. Entity-DTO 노출**: Controller 가 `@Entity` 직접 응답. Response DTO + `static from(Entity)` 강제.
- **BE3. AOP 자기호출 우회**: 같은 클래스 내 `@CacheEvict` / `@Transactional` 자기 호출 → 프록시 우회 무효.

### dooray-cli (TypeScript / Commander.js / tsup)

- **CLI1. exitCode 누락**: 에러 분기에 `process.exit(N)` / `throw new DoorayCliError` 누락 → 0 으로 종료.
- **CLI2. ky 외 HTTP 클라이언트**: `axios` / `node-fetch` / `got` import → 번들 / 일관성.
- **CLI3. 캐시 일관성**: `~/.dooray/cache/` write atomic + read schema 검증 (Zod).

### fos-blog (Next.js 16 / Drizzle ORM / MySQL / pino)

- **BLG1. Drizzle `db:push` 금지** (프로덕션). `pnpm db:generate` → SQL 커밋 → `pnpm db:migrate`. 로컬 한정 예외 + 커밋 전 revert.
- **BLG2. pino 구조화 로그 컨텍스트 누락**. 최소 `{component, operation, ...domainContext, err}` 4-field.
- **BLG3. GitHub sync silent 실패 금지**. Octokit 호출의 `try { ... } catch { return null }` 차단. 구조화 로그 + throw 또는 `SyncResult.failure`.
- **BLG4. Markdown 렌더 XSS 회피**. `react-markdown` + `rehype-raw` 조합은 `rehype-sanitize` 동반 또는 source 자기 소유 명시 주석.
- **BLG5. Next.js 16 proxy 규약** (NJS15 잔재 방지). `src/proxy.ts` = NJS16 정식 file convention. root `middleware.ts` 금지. `runtime` config 금지. `middleware-manifest.json` 비었다고 dead code 판단 금지.
- **BLG6. `"use client"` 잘못 마킹 사고** (plan014 관측). `useState` / `useEffect` / `onClick` / `navigator` / `window` / `document` 사용 0건인데 `"use client"` 가 붙어 있으면 RSC server 첫 패스에서 client 컴포넌트 트리 평가가 일어나 sync 처리 (예: `react-markdown` 의 `runSync`) 가 server 에서 실행됨. shiki / mermaid 등 async 의존성이 있는 라이브러리와 결합하면 `runSync finished async` 같은 사고 발생. **검출**: `grep -l '"use client"' src/components/*.tsx | xargs -I{} sh -c 'grep -L "useState\|useEffect\|useRef\|onClick\|onChange\|navigator\\.\|document\\.\|window\\." {} && echo "{}: 잘못된 use client 의심"'`. **Good**: 인터랙션이 정말 없으면 `"use client"` 제거 (server component). 일부만 인터랙션이면 island 분리 (CodeCard / Mermaid 패턴).
- **BLG7. task 파일 안의 테스트 코드 스니펫에 `as any` 금지** (PR #92 관측). phase-XX.md 의 ts 코드 블록은 executor 가 거의 그대로 복사 → 프로덕션 테스트 코드의 일부가 됨. `(tree as any)` / `(c: any)` / `as string[]` 같은 escape hatch 가 들어가면 type-check 가 unchecked 로 통과해 진짜 검증 의미 약화. **Good**: hast 트리는 `import type { Root, Element, ElementContent } from "hast"` + `function isElement(n: ElementContent): n is Element` type guard 패턴. union 가능 속성 (`Properties.className: string[] | string | number`) 은 `Array.isArray()` 가드. **Why**: planning doc 수준에서 깨끗한 코드 예시 = executor 의 1-shot 통과율 ↑.
- **BLG8. prose-scoped 클래스 셀렉터는 `.prose` prefix 일관성 유지** (PR #93 관측). `.code-card-body` 처럼 마크다운 렌더러 안에서만 쓰이는 클래스의 자식 셀렉터를 `.prose` 없이 작성하면 미래에 다른 컨텍스트에서 사용 시 의도치 않은 스타일 누출. plan017 의 shiki dual theme 규칙이 이 패턴을 어겨 리뷰 지적. **Good**: `html.dark .prose .code-card-body pre span { ... }` — 기존 `.prose .code-card-body { padding: ... }` 규칙들과 일관. **검출**: `grep -nE '\.code-card-body' src/app/globals.css` 결과 중 `.prose` prefix 없는 셀렉터. **Why**: 일관된 스코프는 향후 컴포넌트 재사용 시 회귀 차단 + critic 이 globals.css 변경 평가 시 사전 점검할 패턴.
- **BLG9. JSDoc/TSDoc 코멘트에 Tailwind 클래스 패턴 금지** (PR #94 관측). Tailwind v4 의 content scanner 가 `.ts`/`.tsx` 파일의 **코멘트 안 문자열까지** 클래스 후보로 추출 — `text-[var(--color-cat-*)]` 의 `*`, `text-[var(--color-cat-{key})]` 의 `{` `}` 가 그대로 layer utilities 에 invalid CSS 생성 → `Unexpected token Delim('*')` 또는 `CurlyBracketBlock` parse error → 모든 페이지 500. **검출**: 코멘트에 `[var(--`, `text-[`, `bg-[` 같은 패턴이 있고 그 안에 `*` / `{` / `}` 가 들어 있으면 위험. **Good**: 코멘트에서 클래스 패턴 자체를 prose 로 표현 (예: "color-cat 토큰 (canonical key 별)"), 코드 예시 필요하면 `text-[var(--color-cat-X)] 형태` 로 placeholder 만 쓰기. 추가 안전망: `globals.css` 에 `@source not "../../tasks/**"` / `@source not "../../docs/**"` 추가 (tasks/ 와 docs/ 의 markdown 도 default scan 대상). **Why**: 한 번 발생하면 dev 통째로 다운. plan017 task 작성 중 직접 발생.

---

이 파일은 3 레포 (fos-blog / webtoon-maker-v1 / 기타) 에서 동기화된다. 레포 고유 패턴은 § 4 +α 섹션에만 추가.
