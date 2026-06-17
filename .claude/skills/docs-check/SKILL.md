---
name: docs-check
description: 문서 점검 스킬. docs/ 전체를 5축(부패·과대화·추론성·중복·자명성)으로 검증하고 정리 제안 리포트를 생성. ADR은 "기술 의사결정만 / 최종 상태만 / 코드로 자명하지 않은 것만" 유지. build-with-teams 완료 후 주기적으로 실행 권장.
---

# docs-check

docs/ 하위 문서를 **AI 에이전트가 최소 컨텍스트로 의사결정 의도를 재구성할 수 있는 상태**로 유지하기 위한 점검 스킬.

## 핵심 철학

**ADR은 "현재 유효한 기술 의사결정"의 참고자료이지 프로젝트 역사책이 아니다.** AI 에이전트가 grep하여 능동 참조할 가치가 있으려면, 문서의 **대부분**이 "코드만 보고는 알 수 없는 WHY"여야 한다. 자명한 결정·마이그레이션 기록이 누적되면 시그널 대비 노이즈 비율이 떨어져 결국 아무도 안 읽는다.

## 왜 필요한가

AI 에이전트는 코드만큼 docs를 신뢰한다. 그러나 docs가 다음 상태면 문제:
- **부패**: 코드가 바뀌었는데 docs가 그대로 → 잘못된 코드 생성
- **비대**: ADR에 코드 스니펫·파일 경로·구현 세부가 누적 → 컨텍스트 낭비 + "왜"가 묻힘
- **추론 불가**: "무엇을"만 있고 "왜"가 빠짐
- **중복**: 같은 내용이 여러 docs에 반복 → 한쪽만 수정되어 불일치
- **자명**: 코드/설정만 봐도 알 수 있는 내용이 ADR에 기록 → 시그널 대비 노이즈 증가

## 검증 5축

### A. 부패 (Decay)

코드가 docs와 맞는가. 제거된 엔티티가 docs에 남아있지 않은가.

- 제거된 함수/컴포넌트명이 flow.md·docs/adr/에 남아있음
- DB 스키마와 data-schema.md 테이블/필드 불일치
- 디렉터리/파일 경로가 실제와 다름
- "제거 완료" ADR의 제거 대상이 여전히 코드에 존재

### B. 과대화 (Bloat)

ADR·docs가 구현 세부로 비대해졌는가.

**ADR은 "기술적 의사결정"만 담는다.** 구현 결과(컴포넌트 트리·파일 배치·함수 호출)는 코드에 있다. ADR이 답해야 할 질문은 *"무엇을 / 왜 / 다른 선택지는 왜 아닌가"*뿐.

**최종 상태만 기록 — 중간 단계는 제거한다.** ADR은 "현재 이렇게 되어 있다" + "왜 이 결론에 도달했는가"만 남기고, 여러 번 이터레이션한 중간 작업/변경 항목 목록은 삭제. 진화 과정이 의미 있으면 한 문장으로 응축.

검출 대상:
- ADR 본문 내 코드 블록 (긴 구현 예시)
- 파일 경로 3개 이상 나열
- 변수/함수/프롭 이름을 줄 단위로 나열하는 표
- "사용 예시" 섹션에 컴포넌트 호출 코드 복붙
- CLAUDE.md 스택 규칙을 반복하는 문장
- "새 디렉터리 구조", "변경 항목 목록", "레거시 삭제 목록" 같은 작업 내역

> 정당한 예외: **단일 결정 표현에 필요한 최소한의 식별자**(attribute 이름 1~2회, 타입명 1회 등)는 허용.

### C. 의사결정 추론성 (Clarity)

ADR이 "왜"를 담고 있는가. "결정 / 맥락 / 대안 기각" 구조가 있는가.

검출 대상:
- "결정"만 있고 "맥락/이유/대안"이 없는 ADR
- 맥락이 "요구사항 추가" 같은 순환 설명
- 대안 기각이 없거나 "기각"만 있고 "왜 기각인지" 근거 없음

### D. 중복 (Duplication)

같은 내용이 여러 docs에 반복되는가.

검출 대상:
- 같은 필드 목록이 docs/adr/NNN-slug.md + data-schema.md 양쪽에
- 흐름 요약이 prd.md + flow.md 양쪽에
- CLAUDE.md 스택 규칙이 code-architecture.md에 복사

원칙: **정의 1곳 + 다른 문서는 link 또는 짧은 참조**

### E. 자명성 (Self-evidence) — ADR 전용

**코드/설정 파일만 봐도 알 수 있는 결정은 ADR로 남기지 않는다.** ADR의 가치는 "코드를 봐도 알 수 없는 맥락"에 있다.

**폐기 후보 유형**:

| 유형 | 예시 | 근거 |
|---|---|---|
| 라이브러리/패키지 선택 | "X 사용", "Y 사용" | `package.json`/`build.gradle.kts` 등으로 자명 |
| 폴더·디렉터리 구조 결정 | "X 폴더 분리", "Y로 중복 제거" | 실제 디렉터리 트리로 자명 |
| 단순 마이그레이션 기록 | "X 컬럼 제거", "Y → Z로 이름 변경" | 스키마 + git log로 자명 |
| 일반 프로그래밍 원칙 | "중복 코드는 공통 함수로 추출" | 상식 |
| 환경 설정 | "개발 포트 분리", "Docker Compose 구성" | `docker-compose.yml`/`package.json` scripts로 자명 |

**유지 기준** (아래 중 최소 하나):
1. **라이브러리 고유 함정** — 문서에 없거나 직관에 반하는 API 특성
2. **실험 결과** — A/B 비교로 도출된 근거
3. **대안 기각 근거** — "왜 이 선택이 아닌가"가 미래 논의에서 재발할 여지가 있을 때
4. **정책/규칙 결정** — 팀 합의로 정해지고 준수해야 할 규율
5. **비용/성능 트레이드오프 근거** — 수치가 있는 결정

**자명성 판정 질문**:
- 이 ADR이 없어도 코드/설정/git log로 같은 정보를 얻을 수 있나?
- "왜"가 1~2문장으로 정리되지 않고 그냥 "그렇게 되어 있다" 수준인가?
- 다른 프로젝트에서도 일반적으로 하는 선택인가?

세 질문에 YES가 대부분이면 폐기 대상.

## 거울 구조 자동 검증 (3종 grep)

planning skill 의 "문서 책임 표" (단일 소스 원칙) 위반과 깨진 참조를 자동 검출한다.
5축 의미 검증과 별도로, docs-check 호출 시 가장 먼저 실행 — fail-fast.

### (a) ADR 과대화 검출

ADR 한 항목이 자명성 게이트 (planning "ADR 자명성 게이트") 의 금지 조건을 위반하는가:

- 코드 블록 15줄 이상 (식별자 예시는 1~3줄만 허용)
- 파일 경로 3개 이상 나열

```bash
# cwd: <repo root>
for f in docs/adr/[0-9]*.md; do
  awk '
    /^## ADR-/ { adr=$0; code_lines=0; path_count=0; in_code=0; next }
    /^```/ {
      if (in_code) {
        if (code_lines > 15) print adr " — 코드 블록 " code_lines "줄 (>15)"
        code_lines=0
      }
      in_code = !in_code; next
    }
    in_code { code_lines++ }
    /`[a-z_]+\/[a-zA-Z0-9_\/.-]+\.(ts|tsx|md|js|mjs|json|sql|sh)`/ { path_count++ }
    END {
      if (path_count >= 3) print adr " — 파일 경로 " path_count "개 (≥3)"
    }
  ' "$f"
done
# 기대: 0건 출력 — 발견 시 해당 ADR 정리 필요
```

### (b) page docs Related Files 정합

`docs/pages/*.md` 의 "Related Files" 섹션에 나열된 코드 경로가 실제 파일 시스템에 존재하는가:

```bash
# cwd: <repo root>
for doc in docs/pages/*.md; do
  awk '
    /^## Related Files/ { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section {
      n = split($0, parts, "`")
      for (i=2; i<=n; i+=2) {
        p = parts[i]
        if (p ~ /^(src|drizzle|scripts|local|public)\//) print FILENAME ":" NR ": " p
      }
    }
  ' "$doc"
done | while IFS= read -r line; do
  # bash parameter expansion 으로 path 추출 (subshell PATH 이슈 회피)
  path="${line##*: }"      # 마지막 ": " 이후
  path="${path%% *}"        # 첫 공백 앞까지
  test -e "$path" || echo "BROKEN: $line"
done
# 기대: "BROKEN:" 출력 0건
```

깨진 참조 발견 시 AskUserQuestion 흐름 (각 깨진 경로마다):

- 옵션 1: **docs 행 제거** — 코드에서 삭제된 컴포넌트
- 옵션 2: **docs 경로 수정** — 파일이 이동/rename 됨, 새 경로 지정
- 옵션 3: **파일 복구 필요** — 의도하지 않은 삭제, 코드 쪽 수정 필요

### (c) 문서 책임 표 위반 (ADR 에 page docs 전용 헤딩)

`docs/adr/NNN-slug.md` 에 page docs / code-architecture 전용 섹션 헤딩이 등장하는가.
등장하면 책임 분리 위반 (한 ADR 안에서 페이지 PRD 를 재서술 중):

```bash
# cwd: <repo root>
for f in docs/adr/[0-9]*.md; do
  awk '
    /^## ADR-/ { adr=$0; next }
    /^### (Related Files|Components|Interactions|Client State|Server-side Processing|Layout|SEO|Data)/ {
      print adr " — page docs 전용 헤딩 출현: " $0
    }
  ' "$f"
done
# 기대: 0건 — 발견 시 해당 ADR 본문을 결정/맥락/대안 기각 형태로 정리
```

검출되는 헤딩 목록 (B2 옵션 — 분명한 신호만):

- `Related Files` (page docs 전용)
- `Components` (page docs 전용)
- `Interactions` (page docs 전용)
- `Client State` (page docs 전용)
- `Server-side Processing` (page docs 전용)
- `Layout` (page docs 전용)
- `SEO` (page docs 전용)
- `Data` (page docs 전용, "## Data" 형식)

위 헤딩이 ADR 안에 있으면 → 해당 정보는 `docs/pages/{page}.md` 단일 소스로 이전 + ADR 에는 결정 근거만 남김.

### 호출 시점

본 3종 grep 은 `/docs-check` 호출 시 "## 실행 절차" 의 "1. 대상 파일 수집" 직후 자동 실행.
PreCommit hook 등 별도 자동화 없음 (skill 호출 시점만).

검출 결과는 "## docs-check 결과" 의 **Critical** 카테고리에 자동 분류 — 모두 즉시 수정 권장 등급:

- (a) 과대화
- (b) 깨진 참조
- (c) 책임 위반

## 실행 절차

### 0. 검증 위임 (필수 — 단일 소스)

docs-check 의 5축 검증은 **반드시** custom agent `fos-blog-docs-verifier` (`.claude/agents/fos-blog-docs-verifier.md`) 에 위임. agent 본문이 검증 항목·자동 grep 명령·도메인 지식의 단일 소스 — main session 이 직접 grep 을 베끼는 순간 정의 두 곳 동기화 부담 발생.

fos-blog 도메인 지식 (ADR-001~025 / 핵심 5 docs / Drizzle schema / 레이어 규칙 / 홈서버 배포 가드 / docs/pages/ 7개) 이 박힌 custom agent 에 위임:

```
Agent({
  subagent_type: "fos-blog-docs-verifier",
  description: "5-axis docs audit",
  prompt: "전체 docs (docs/*.md + docs/pages/*.md + .claude/skills/*/SKILL.md + _shared/*.md) 5축 점검. ADR Index 동기화 / 30줄 bloat / page.tsx ↔ docs/pages 정합 / Drizzle schema ↔ data-schema.md / 홈서버 배포 가드 / 매트릭스 용어 모두 자동 검증. Critical / Warning / Safe 분류 보고."
})
```

agent 가 자동 grep 검증 (ADR Index sync / anchor 누락 / 30줄 bloat / 구분선 sanity / Drizzle schema 정합 / page docs 정합 / Vercel 가드 / 매트릭스 용어) 까지 수행하므로 main session 부담 감소. 결과 받아 Critical 항목부터 사용자 승인 후 수정.

#### Fallback — agent 사용 불가 환경

1. agent 본문 도메인 변경 후 미갱신 발견 — agent 갱신 후 재위임 권장
2. Claude Code 가 아닌 환경 — agent 본문의 grep 을 직접 실행 (아래 1~5 단계 legacy 경로)

### 1. 대상 파일 수집

```bash
# cwd: <repo root>
ls docs/*.md docs/pages/*.md .claude/skills/*/SKILL.md .claude/skills/_shared/*.md
```

**자동 grep 검증 사전 실행**: 대상 파일 수집 직후, 의미 검증 (5축) 전에 위 "거울 구조 자동 검증 (3종 grep)" 의 3개 명령을 실행한다.
검출 결과는 의미 검증과 함께 최종 리포트의 Critical 섹션으로 통합.

### 2. 각 문서에 5축 점검 수행

- **docs/adr/NNN-slug.md**: E(자명성) 최우선 + B(bloat) + C(추론성) + A(제거 ADR의 dead reference)
- **flow.md**: A (언급 컴포넌트 존재 여부) + D (prd.md와 중복) + B (UI 목업·API 경로 나열)
- **data-schema.md**: A (스키마 정합) + D (ADR과 중복)
- **code-architecture.md**: A (디렉터리 실재) + B (코드 스니펫) + D (CLAUDE.md와 중복)
- **prd.md**: D (flow.md와 중복) + C (기획 의도가 "왜")
- **docs/pages/*.md**: A (실제 page.tsx 와 흐름 / 컴포넌트 / Data 표 정합) + D (prd 와 중복)
- **CLAUDE.md**: "상황별 ADR 필수 참조" 표의 ADR 번호가 실제 존재하는지
- **`.claude/skills/*/SKILL.md`**: B (과대화) + C (추론성) + D (다른 스킬과 중복) + 자명성 변형 (아래)

### 2-1. 스킬 SKILL.md 의 5축 적용 (특수 규칙 — webtoon-maker-v1 이식)

스킬은 AI 에이전트가 호출 시점에 컨텍스트로 로드 → 장황하면 토큰 낭비 + 핵심 지시가 묻힘. ADR 과 다른 자명성 기준 적용:

| 축 | 스킬 적용 |
|---|---|
| **B 과대화** | 사고 사례 길게 서술 (왜·언제 발생·증상) / 자명한 부연 / 다른 스킬과 중복되는 일반 원칙 모두 bloat. 핵심 지시 + 검증 명령 + 1줄 사유로 응축 |
| **C 추론성** | 지시만 있고 "왜 이 가드가 필요한지" 추론할 단서 1줄이 없으면 미래의 에이전트가 가드를 우회할 위험 |
| **D 중복** | 같은 가드 / 원칙이 여러 스킬에 반복되면 `.claude/skills/_shared/` 로 추출 |
| **자명성 (E 변형)** | "AI 에이전트의 일반 행동 디폴트로 추론 가능" 한 지시는 제거. 예: "tool 호출 결과 확인 후 다음 단계 진행" 같은 자명한 절차 |

**검출 신호**:
- SKILL.md 한 섹션에 사고 사례 (plan###) 2개 이상 나열 → 하나로 응축. 진화 과정이 의미 있으면 "X 였다가 Y 과정을 거쳐 최종 Z 로 수렴" 한 문장
- 같은 규칙을 "필수" / "강제" / "반드시" 세 번 반복
- 한 항목에 코드 블록 / 인용 / 표가 모두 등장 (보통 1~2개로 충분)
- 다른 스킬에 동일한 cwd 격리 / scope 가드가 다른 표현으로 중복

### 3. 항목별 리포트 작성

각 발견 항목을 아래 포맷으로:

```markdown
#### [축] docs/adr/NNN-slug.md ADR-XXX — {한 줄 요약}
- **위치**: line N~M
- **문제**: {예: 15줄 코드 블록, 컴포넌트 사용 예시 — bloat}
- **근거**: {CLAUDE.md 규칙 / 실측 / 중복 문서}
- **제안**: {예: "결정에서 식별자 1회 언급으로 압축, 스니펫 제거"}
- **대안**: {유지 근거가 있다면 명시}
```

### 4. 리포트 요약 출력

```markdown
## docs-check 결과

### Summary
- 검사 파일: N개
- 발견: 부패 X / 과대화 Y / 추론성 Z / 중복 W / 자명성 V

### Critical (즉시 수정 권장)
{축별 목록}

- 부패 / 오정합 (의미 검증 5축 A 결과)
- 거울 구조 위반 — 자동 grep 검출 (위 "거울 구조 자동 검증" 섹션):
  - (a) ADR 과대화 — 코드 블록 15줄+ 또는 파일 경로 3+
  - (b) 깨진 Related Files 참조
  - (c) ADR 에 page docs 전용 헤딩 등장

### Warning (수동 판단)
{축별 목록}

### 안전 (개선 권장, 블로킹 아님)
{축별 목록}

### 다음 단계 제안
- (A) 이번 세션에서 즉시 정리
- (B) plan{N}으로 task화하여 build-with-teams 실행
```

### 5. 사용자 승인 후 정리

**절대 사용자 승인 없이 docs를 수정하지 않는다** — 일부 "bloat"는 의도적 보존(예: 마이그레이션 가이드 임시) 가능.

승인된 항목만 순차 수정. 각 수정은 최소 diff — 결정 의도는 보존하되 표현/구조만 슬림화.

## 정리 원칙 (수정 시 적용)

### ADR 표준 구조

```markdown
## ADR-XXX: {제목 — 결정의 한 줄 요약}

- **결정**: {무엇을 — 1~3문장}
- **맥락**: {왜 이 결정이 필요했는가 — 제약/데이터/사용자 관찰}
- **대안 기각**: {왜 다른 옵션을 선택하지 않았는가 — 각 대안 1~2줄}
- **(선택) 적용 범위**: {경계}
```

**금지**:
- 15줄 넘는 코드 블록
- 파일 경로 3개 이상 나열
- 구현 호출 방법·컴포넌트 props 나열
- CLAUDE.md 스택 규칙 반복

### 문서 간 책임 분리

| 문서 | 담당 |
|---|---|
| `prd.md` | 제품 목적 + MVP 범위 + 우선순위 |
| `flow.md` | 사용자 흐름 + 화면/명령 전환 |
| `docs/adr/README.md` + `docs/adr/NNN-slug.md` | 기술 결정 + 왜 + 대안 기각 |
| `data-schema.md` | DB 테이블 + 관계 + 제약 |
| `code-architecture.md` | 디렉터리 + 레이어 + API 전략 |

**같은 내용은 한 문서에만** — 다른 문서는 `(ADR-XXX 참조)` 링크.

### 새 ADR 작성 시 체크리스트

ADR 추가 전 아래를 **반드시 자문**:

1. **[필수] 자명성 통과**: 코드·설정·git log만 보고 같은 정보를 얻을 수 있으면 ADR로 기록하지 않는다
2. **[필수] 라이브러리 함정·실험 결과·대안 기각·정책·트레이드오프 중 하나에 해당**
3. **[필수] 결정/맥락/대안 기각 3요소**: 하나라도 비면 추론성 부족
4. **[필수] 구현 세부 제거**: 코드 스니펫 10줄 이상, 파일 경로 3개 이상 나열, 작업 내역 제거
5. **[필수] 인덱스 동기화**: `docs/adr/NNN-slug.md` 신규 파일 생성 + `docs/adr/README.md` 의 적절한 분류에 한 줄 (`[ADR-XXX](./NNN-slug.md) — 한 줄 요약`) 추가. `<a id>` 앵커는 불필요 (파일 자체가 단위)
6. **[권장] CLAUDE.md 상황별 참조 등록**: 코드 작업 중 반드시 확인해야 하는 ADR이라면 등록

### ADR 수정/폐기 시

- **의사결정이 번복된 경우**: 대체 ADR 작성 + 과거 ADR 본문 **완전 삭제** (Superseded 표기 남기지 않음). 과거 결정의 근거는 git log + 새 ADR 본문에 녹여 보존
- **변경 사항을 부분적으로 수용한 경우**: 기존 ADR 본문에서 해당 부분만 삭제/수정. 대안 기각에 "옵션 X는 Y 이유로 번복됨" 한 줄 추가
- **자명성 폐기 시**: 본문 + Index 에서 동시 삭제. **폐기된 번호는 결번으로 영구 보존, 새 ADR 에 재할당 금지** — git log 와 외부 참조 (issue / commit / docs-verifier 메모리) 가 과거 ADR 번호를 가리킬 때 다른 결정으로 오인되지 않도록. agent 본문의 ADR 인덱스 섹션에도 *"결번: NNN (사유). 재할당 금지"* 명시 (현재 fos-blog 결번: ADR-012)

## ADR Index 동기화 검증 (필수 자동 검사)

ADR 본문에 새 ADR 이 추가됐는데 상단 Index 에 누락되면 AI 에이전트가 빠르게 탐색 못함. docs-check 실행 시 아래 자동 검증:

```bash
# cwd: <repo root>

# 1) ADR 파일 목록에서 번호 추출 (파일명 기반)
BODY=$(ls docs/adr/[0-9]*.md | grep -oE '[0-9]{3}' | sort -u | sed 's/^/ADR-/')

# 2) INDEX 에 링크된 ADR 번호 목록
INDEX=$(grep -oE '\[ADR-[0-9]+\]' docs/adr/README.md | grep -oE 'ADR-[0-9]+' | sort -u)

# 3) 파일 ⊂ INDEX 검증
diff <(echo "$BODY") <(echo "$INDEX") && echo "OK: ADR Index synced"

# 4) 파일 ↔ INDEX 정합 검증 (INDEX 항목마다 대응 파일 존재 확인)
for n in $(echo "$INDEX"); do
  nnn=$(echo "$n" | grep -oE '[0-9]+' | awk '{printf "%03d", $1}')
  ls docs/adr/${nnn}-*.md > /dev/null 2>&1 \
    || echo "MISSING file: $n (docs/adr/${nnn}-*.md not found)"
done

# 5) 파일별 30줄 초과 ADR 자동 검출 — "기능 명세서 변질" 의심 (B 과대화)
for f in docs/adr/[0-9]*.md; do
  n=$(basename "$f" | grep -oE '^[0-9]+')
  size=$(wc -l < "$f" | tr -d ' ')
  [ "$size" -gt 30 ] && echo "BLOAT: ADR-$n ($size lines, > 30) — 결정/맥락/대안 기각 외 기능 명세 의심. 슬림화 검토"
done
```

리포트의 [축] 헤더에 `[Index]` / `[Bloat]` 표시로 별도 분류. 누락/초과 발견 시 **반드시 갱신 후 다음 검증 진행**.

## 핵심 docs 최신화 자동 검증 (코드 ↔ docs 부패 감지)

ADR / PRD / code-architecture / flow / data-schema 5 핵심 docs 가 코드와 동기화 상태인지 자동 검사. agent (`fos-blog-docs-verifier`) 가 우선 수행하나, 직접 점검 시:

```bash
# cwd: <repo root>

# 1) Drizzle schema ↔ data-schema.md 테이블 일치
SCHEMA_TABLES=$(grep -oE 'mysqlTable\("[a-z_]+"' src/infra/db/schema/*.ts | grep -oE '"[a-z_]+"' | sort -u)
DOC_TABLES=$(grep -oE '^### `[a-z_]+`' docs/data-schema.md | grep -oE '`[a-z_]+`' | sort -u)
diff <(echo "$SCHEMA_TABLES") <(echo "$DOC_TABLES") && echo "OK: data-schema sync"

# 2) page.tsx ↔ docs/pages/{name}.md 정합
ROUTES=$(find src/app -name "page.tsx" ! -path "*api*" ! -path "*\\(*" | sed 's|src/app/||;s|/page\.tsx||' | grep -vE '^\[|/\[' | sort)
DOCS=$(ls docs/pages/*.md 2>/dev/null | xargs -n1 basename | sed 's|\.md||' | sort)
echo "Routes:"; echo "$ROUTES"
echo "Docs:"; echo "$DOCS"
# 신규 page.tsx 인데 docs/pages/{name}.md 부재 시 UPDATE_NEEDED

# 3) PRD MVP 범위 ↔ 실제 구현 (수동 — agent 가 도메인 지식으로 매핑)
grep -nE "^- |^[0-9]+\. " docs/prd.md | head -30

# 4) code-architecture.md 디렉터리 ↔ 실제
grep -E "^├──|^│|^└──" docs/code-architecture.md | grep -oE "[a-zA-Z][a-zA-Z_-]*\.?(ts|tsx|md)?" | sort -u

# 5) flow.md 의 URL 경로 ↔ 실제 라우트
grep -oE '/[a-z][a-z/-]*' docs/flow.md | sort -u

# 6) 홈서버 배포 가드 — Vercel-only 기능 권장 검출 (VIOLATION)
grep -rnE "Vercel Cron|Edge Functions|vercel\.json" docs/ CLAUDE.md README.md 2>/dev/null && echo "VIOLATION: Vercel-only 기능 권장 docs 에 등장"

# 7) 매트릭스 용어 회피 (CLAUDE.md global rule)
grep -rnE "매트릭스|matrix" docs/ .claude/skills/ CLAUDE.md 2>/dev/null && echo "VIOLATION: 매트릭스 용어 — 표/분류 표 등으로 정정"
```

agent 위임 시 이 검증들이 모두 자동 수행됨. 직접 실행 시 결과 항목별로 Critical/Warning/Safe 분류 후 사용자 승인.

## 실행 주기 권장

| 시점 | 이유 |
|---|---|
| build-with-teams 대규모 plan 완료 후 | 코드 변경이 docs에 반영됐는지 + 신규 ADR이 bloat 없이 작성됐는지 |
| 외부 PR 머지 후 | docs에 미반영된 변경 포함 가능 |
| 분기별 정기 | 점진적 부패·비대화 감지 |

## build-with-teams 연계

build-with-teams의 docs-verifier는 **해당 task 범위만** 검증. 이 스킬은 **전체 docs**를 5축으로 스캔.

| 도구 | 범위 | 시점 | 축 |
|---|---|---|---|
| docs-verifier (build-with-teams 내) | 현재 task 변경 코드 ↔ docs | task 실행 직후 | A (부패) 중심 |
| docs-check (이 스킬) | 전체 docs ↔ 전체 코드 + 품질 | 주기적 / 수동 | A/B/C/D/E 전체 |
