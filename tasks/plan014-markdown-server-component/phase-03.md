# Phase 03 — 통합 검증 + ADR-019/020 상호 참조 + index.json status="completed" 마킹

## 컨텍스트 (자기완결 프롬프트)

phase-01 + phase-02 완료 전제. 이 phase 는 production 사고 (`runSync finished async`) 가 더 이상 발생하지 않는지 빌드 산출물에서 확인 + ADR 상호 참조 마무리 + tasks/index.json status 마킹. main 직접 commit 회피 위해 PR 브랜치 안에서 마킹.

### 사전 게이트

```bash
# cwd: <worktree root>

# 1) phase-02 산출물 (server component 화 + react-markdown 제거)
! grep -n '"use client"' src/components/MarkdownRenderer.tsx
! grep -n '"react-markdown":' package.json

# 2) ADR-020 docs 반영 확인
grep -n "## ADR-020" docs/adr.md

# 3) plan014 task 파일 자체 무결성
test -f tasks/plan014-markdown-server-component/index.json
jq -r '.total_phases as $t | .phases | length as $p | "total=\($t), len=\($p)"' tasks/plan014-markdown-server-component/index.json   # total=3, len=3
ls tasks/plan014-markdown-server-component/phase-*.md | wc -l   # = 3
```

## 작업 목록 (총 4개)

### 1. 빌드 산출물에서 `runSync` 흔적 사라짐 검증

```bash
# cwd: <worktree root>
pnpm build

# react-markdown 의 runSync 호출이 빌드 산출물에서 완전히 사라졌는지
! grep -rE "runSync.*finished async|react-markdown" .next/server/chunks/ssr/ 2>/dev/null

# unified async chain 이 빌드 산출물에 포함됐는지
grep -rE "hast-util-to-jsx-runtime|toJsxRuntime" .next/server/chunks/ 2>/dev/null | head -3

# 구체적 SSR chunk 검사 (production 에러에서 등장한 패턴)
grep -rE "Function.runSync" .next/server/chunks/ 2>/dev/null | wc -l   # = 0 기대
```

### 2. 기존 regression test + 신규 회귀 케이스 추가

`src/components/MarkdownRenderer.regression-1.test.ts` 에 다음 케이스가 포함되도록 보강 (없으면 추가):

```ts
it("server async component — runSync 회귀 방지: shiki 로 코드 블록 렌더 시 throw 하지 않음", async () => {
  const md = "```ts\nconst x = 1;\n```";
  const tree = await import("./markdown/unified-pipeline").then((m) => m.parseMarkdownToHast(md));
  // tree 안에 figure / shiki span 존재 (rehype-pretty-code 가 정상 동작)
  expect(JSON.stringify(tree)).toMatch(/data-rehype-pretty-code-figure/);
});

it("server async component — mermaid 블록은 data-language=mermaid 로 표시", async () => {
  const md = "```mermaid\ngraph TD; A-->B;\n```";
  const tree = await import("./markdown/unified-pipeline").then((m) => m.parseMarkdownToHast(md));
  expect(JSON.stringify(tree)).toMatch(/"data-language":\s*"mermaid"/);
});
```

### 3. ADR 본문 상호 참조 / 메모 보강 (선택, 자명성 게이트 통과 시)

ADR-019 의 "Implementation 순서" 끝에 plan014 후속 메모는 이미 들어 있음 (planning 단계). 추가 변경 없으면 skip.

ADR-020 본문에 plan014 PR 번호가 결정되면 향후 doc-check 단계에서 갱신. 이번 phase 에서는 변경 없음.

### 4. tasks/index.json 마킹 + 사후 cleanup

```bash
# cwd: <worktree root>

# top-level + phases[0,1,2] 모두 completed
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan014-markdown-server-component/index.json

# 검증: completed 가 정확히 4회 (top-level + 3 phases) 등장
grep -c '"status": "completed"' tasks/plan014-markdown-server-component/index.json   # = 4
! grep -n '"status": "pending"' tasks/plan014-markdown-server-component/index.json
```

**왜**: 다음 build-with-teams 사전 검증 3중 체크 통과 위해. PR 머지 전 단계에서 완료 마킹은 PR 브랜치 안에 포함 (main 직접 커밋 회피).

## 성공 기준 (기계 명령만)

```bash
# cwd: <worktree root>

# 1) react-markdown 흔적 0
! grep -n '"react-markdown":' package.json
! grep -rn 'from "react-markdown"' src/
! grep -rE "Function.runSync" .next/server/chunks/ 2>/dev/null

# 2) unified async pipeline 산출물 포함
grep -rE "hast-util-to-jsx-runtime|toJsxRuntime|parseMarkdownToHast" .next/server/chunks/ 2>/dev/null | head -1

# 3) test 통과
pnpm test -- --run src/components/MarkdownRenderer.regression-1.test.ts
pnpm test -- --run

# 4) lint / type-check / build
pnpm lint
pnpm type-check
pnpm build

# 5) tasks/index.json completed 마킹
grep -c '"status": "completed"' tasks/plan014-markdown-server-component/index.json   # = 4
! grep -n '"status": "pending"' tasks/plan014-markdown-server-component/index.json

# 6) 금지사항 (phase-01/02 + 이번 phase 변경 누적)
! grep -rnE "as any" src/components/markdown/ src/components/MarkdownRenderer.tsx
! grep -rnE "console\.(log|warn|error)" src/components/markdown/ src/components/MarkdownRenderer.tsx
```

## PHASE_BLOCKED 조건

- 빌드 산출물에 여전히 `runSync` 패턴 존재 → 다른 client 컴포넌트가 react-markdown 잔재를 import 중. SendMessage 보고
- regression test 의 신규 케이스가 통과 안 됨 → unified-pipeline 의 plugin chain 순서 점검 필요
- production server log 에서 동일 에러 재발 (deploy 후 모니터) → ADR-020 재검토, 별도 plan 분리

## 커밋 제외 (phase 내부)

executor 는 커밋하지 않는다. team-lead 가 일괄 커밋:
- `test(markdown): add server async regression cases (runSync 회귀 방지)`
- `chore(tasks): mark plan014 completed`
