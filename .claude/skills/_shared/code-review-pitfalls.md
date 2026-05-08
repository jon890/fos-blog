# Code Review Pitfalls

build-with-teams 의 code-reviewer 가 반복 지적한 코드 패턴. **plan 작성 시점이 아니라 executor 의 코드 작성 시점에 사전 소진** 한다 (`common-pitfalls.md` 는 plan 작성 회피, 본 docs 는 코드 작성 회피 — 호출 시점이 다름).

## 호출 시점

| 시점 | 누가 | 어떻게 |
|---|---|---|
| plan 작성 | team-lead | phase 본문에 "회피 항목" 으로 1줄 인용 (executor 가 그 phase 만 보고도 알 수 있도록) |
| executor 코드 작성 시작 직전 | executor | 이 docs 의 해당 카테고리 grep → self-check |
| code-reviewer 검사 | code-reviewer | build-with-teams 7단계 검사 항목과 별도로 본 docs 의 모든 항목 grep 게이트 |

## 축적 규칙

- 새 항목 추가 = code-reviewer 가 같은 패턴을 **plan 종료 후 회고 단계에서 발견** 했을 때만. 1회성 단일 사고는 제외 (반복성 확보 후 추가).
- 항목 형식: **증상 / 왜 / 검출 명령 / Self-check**. `common-pitfalls.md` 와 동일.
- "왜 이 가드가 필요한지" 1줄 단서 필수 — 미래 AI 가 의도 모르고 우회하지 않도록.
- plan### 사고 사례는 1개로 충분, 복수 나열 금지.
- 카테고리는 4개로 시작, 새 패턴이 어느 카테고리에도 안 들어가면 5번 카테고리 추가.

---

# 1. (시드 — 누적 시작 전)

fos-blog code-reviewer 가 반복 지적한 코드 패턴이 누적되면 본 섹션을 첫 카테고리로 채운다. 현재는 비어있으나 다음 plan 의 code-reviewer 회고에서 추가 시작.

후보 카테고리 (dooray-cli 참조):
- 1. UX 순서 회귀 (spinner / validation 순서)
- 2. 외부 API 응답 타입 가드 (Zod 미적용 / unsafe `as`)
- 3. 에러 처리 패턴 (`Promise.all` vs `Promise.allSettled`)
- 4. AI slop 주석 (함수명 한국어 번역만)

이 패턴들이 fos-blog 에서도 재발 시 본 docs 에 추가.

---

## 참고 — common-pitfalls.md 와 차이

| 시점 | 대상 | 회피 단계 |
|---|---|---|
| `common-pitfalls.md` | plan / task 작성 시 critic 이 지적할 패턴 | team-lead (plan 작성) |
| `code-review-pitfalls.md` | 코드 작성 시 code-reviewer 가 지적할 패턴 | executor (코드 작성) |

common-pitfalls 는 "task 가 잘 짜여졌는가", code-review-pitfalls 는 "코드가 잘 짜여졌는가" 의 차이. 두 docs 는 **상호 참조 금지** — 각자 책임 시점이 다르므로 한쪽만 갱신되어도 다른 쪽 영향 없음.
