# docs-check 오버레이 — fos-blog

공용 `docs-check`에 fos-blog의 문서 범위와 코드 대조 기준을 주입한다.
문서 책임은 설치된 `planning` 스킬의 “필수 관리 문서” 계약을 따른다.
이 파일은 fos-blog의 검사 범위와 코드 대조 기준만 추가한다.

## 검사 범위

- 제품 문서: `README.md`, `docs/**/*.md`
- 상시 지침: `AGENTS.md`
- 저장소 오버레이: `.claude/*-overlay.md`
- 저장소 스킬 자료: `.agents/skills/*/SKILL.md`, `.agents/skills/_shared/*.md`
- 역할 지침: `.claude/agents/*.md`, `.codex/agents/*.toml`

`AGENTS.md`는 `CLAUDE.md`를 가리키는 심볼릭 링크다.
같은 내용으로 두 번 집계하지 않고 실제 파일인 `CLAUDE.md`를 검사한다.

`.claude/skills/*`는 `.agents/skills/*` 호환 심볼릭 링크다.
링크가 끊어졌는지만 확인하고 내용을 중복 검사하지 않는다.

ADR 본문은 `docs/adr/[0-9]*.md`, 인덱스는 `docs/adr/README.md`다.
결번은 재사용하지 않는다. 어느 번호가 결번인지는 `docs/adr/README.md`를 단일 소스로 삼는다.

## 정적 검사 실행

공용 `~/.claude/skills/docs-check/scripts/static-check.sh`는 추적된 모든 마크다운을 검사하며 제외 경로를 인자로 받지 못한다.
fos-blog는 `tasks/**`가 추적 대상이라 출력이 1000줄을 넘고 대부분이 판정과 무관한 계획 문서다.
전체 실행 대신 아래 저장소 전용 대조를 사용한다.

ADR 인덱스 검사도 이 스크립트에 맡기지 않는다.
스크립트는 인덱스 파일명을 `INDEX.md`로 고정하는데 fos-blog는 `README.md`를 쓴다.

편집한 파일은 `git diff --check`와 한국어 검사기로 별도 확인한다.
기존 위반이 많은 파일은 현재 diff에서 새 위반이 늘지 않았는지 비교하고 기존 부채를 별도 보고한다.
공용 검사기가 인덱스 경로와 파일 목록 인자를 지원하게 되면 이 예외를 제거한다.

## 검증 위임

의미 검증은 읽기 전용 `fos-blog-docs-verifier`에 맡긴다.

- Codex: `.codex/agents/fos-blog-docs-verifier.toml`
- Claude: `.claude/agents/fos-blog-docs-verifier.md`

검증기는 발견을 미리 걸러내지 않고 모두 보고한다.
심각도는 메인 에이전트가 근거를 검토한 뒤 정한다.

## fos-blog 전용 대조

### ADR 인덱스

```bash
BODY=$(find docs/adr -maxdepth 1 -type f -name '[0-9][0-9][0-9]-*.md' -exec basename {} \; | cut -c1-3 | sort -u)
INDEX=$(grep -oE '\[ADR-[0-9]{3}\]' docs/adr/README.md | grep -oE '[0-9]{3}' | sort -u)
diff <(printf '%s\n' "$BODY") <(printf '%s\n' "$INDEX")
```

본문과 인덱스의 번호 집합이 같아야 한다.
인덱스의 상대 링크도 모두 실제 파일을 가리켜야 한다.
번호가 비어 있으면 결번이므로 새 ADR에 그 번호를 배정하지 않는다.

### Drizzle 스키마

여러 줄로 작성된 `mysqlTable()` 선언도 잡도록 다중 행 검색을 사용한다.

```bash
SCHEMA_TABLES=$(rg -U --no-filename -o 'mysqlTable\(\s*"[a-z_]+"' src/infra/db/schema/*.ts | rg -o '"[a-z_]+"' | sort -u)
DOC_TABLES=$(rg -o '^### `[a-z_]+`' docs/data-schema.md | rg -o '`[a-z_]+`' | tr -d '`' | sort -u)
diff <(printf '%s\n' "$SCHEMA_TABLES" | tr -d '"') <(printf '%s\n' "$DOC_TABLES")
```

테이블 이름뿐 아니라 컬럼의 null 허용, 고유성, 기본값, 인덱스도 코드와 문서를 대조한다.

### 페이지 문서

모든 `src/app/**/page.tsx`는 `docs/pages/`에 대응 문서를 가져야 한다.

문서 이름은 라우트 경로에서 유추되지 않는다.
`page.tsx`는 `home.md`, `series/page.tsx`는 `series-index.md`이고,
catch-all 라우트는 `-detail` 접미사를 쓴다.
`docs/pages/*.md` 중 `**File:**`로 대응 라우트를 밝힌 것은 일부뿐이라 코드에서 역추적할 수도 없다.
그래서 아래 표가 이 대응의 단일 소스다.

| 페이지 파일 | 페이지 문서 |
| --- | --- |
| `src/app/page.tsx` | `docs/pages/home.md` |
| `src/app/about/page.tsx` | `docs/pages/about.md` |
| `src/app/categories/page.tsx` | `docs/pages/categories.md` |
| `src/app/category/[...path]/page.tsx` | `docs/pages/category-detail.md` |
| `src/app/contact/page.tsx` | `docs/pages/contact.md` |
| `src/app/glossary/page.tsx` | `docs/pages/glossary.md` |
| `src/app/posts/[...slug]/page.tsx` | `docs/pages/post-detail.md` |
| `src/app/posts/latest/page.tsx` | `docs/pages/posts-latest.md` |
| `src/app/posts/popular/page.tsx` | `docs/pages/posts-popular.md` |
| `src/app/privacy/page.tsx` | `docs/pages/privacy.md` |
| `src/app/series/page.tsx` | `docs/pages/series-index.md` |
| `src/app/series/[name]/page.tsx` | `docs/pages/series-detail.md` |
| `src/app/tag/[name]/page.tsx` | `docs/pages/tag.md` |

표가 라우트 집합과 어긋났는지 먼저 확인한다.
개수 비교로는 라우트 추가와 문서 삭제가 상쇄돼 통과하므로 집합을 대조한다.

```bash
ROUTES=$(find src/app -name 'page.tsx' -type f | sort)
TABLE=$(grep -E '^\| `src/app/' .claude/docs-check-overlay.md | cut -d'`' -f2 | sort -u)
diff <(printf '%s\n' "$ROUTES") <(printf '%s\n' "$TABLE")
```

차이가 있으면 표와 페이지 문서를 함께 갱신한다.
`docs/pages/*.md`의 `Related Files` 또는 `File` 경로는 실제로 존재해야 한다.

### 레이어 경계

`AGENTS.md`의 “아키텍처 경계”를 판정 기준의 단일 소스로 삼는다.
경계 자체를 여기에 옮겨 적지 않는다.

## 판정

- `VIOLATION`: 코드 또는 운영 정책을 어기는 지침
- `UPDATE_NEEDED`: 오래됐거나 빠졌거나 중복된 문서
- `PASS`: 검사 범위와 근거를 제시하고 불일치가 없음

전체 점검은 부패, 과대화, 추론성, 중복, 자명성, 가독성의 6축을 모두 보고한다.
