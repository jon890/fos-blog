# fos-blog docs-check 오버레이

공용 `docs-check`에 fos-blog의 문서 범위와 코드 대조 기준을 주입한다.
문서별 책임은 설치된 `planning` 스킬을 따른다.
이 파일은 fos-blog의 검사 범위와 코드 대조 기준만 추가한다.

## 검사 범위

- 제품 문서: `README.md`, `docs/**/*.md`

`AGENTS.md`, rules, roles, overlays와 skills는 `harness-cleanup`의 감사 대상이다.
제품 문서와 연결된 지침은 판단 근거로 읽되 이 감사에서 수정하지 않는다.

`tasks/`는 검사 대상이 아니다.
완결된 plan의 phase 파일은 실행 당시의 사실을 기록한 것이라,
그때 존재하던 문서가 나중에 삭제돼도 소급해 고치지 않는다.
아직 실행하지 않은 plan이 삭제된 문서를 참조하면 그 plan을 실행할 때 함께 갱신한다.

ADR 본문은 `docs/adr/[0-9]*.md`, 인덱스는 `docs/adr/README.md`다.
결번은 재사용하지 않는다. 어느 번호가 결번인지는 `docs/adr/README.md`를 단일 소스로 삼는다.

## 정적 검사 실행

설치된 `docs-check/scripts/static_check.py`에 ADR 디렉터리 `docs/adr`와 검사 범위를 넘긴다.
전체 제품 문서 감사는 `docs`와 `README.md`를 각각 범위로 실행한다.
변경 범위 감사는 해당 파일이나 디렉터리를 전달하고, 검사 파일 수가 0이면 통과로 보지 않는다.

공용 검사기는 `INDEX.md`가 없으면 ADR 인덱스 대조를 건너뛴다.
따라서 아래 `README.md` 번호 대조도 실행한다.
편집한 파일은 `git diff --check`와 사용자 전역 지침의 한국어·가독성 검사기로 확인한다.

## 검증 위임

의미 검증은 읽기 전용 `fos-blog-docs-verifier`에 맡긴다.
판정과 보고 방식은 [역할 계약](../.agents/roles/fos-blog-docs-verifier.md)을 따른다.

## fos-blog 전용 대조

### ADR 인덱스

```bash
set -eu
set -o pipefail
BODY=$(find docs/adr -maxdepth 1 -type f -name '[0-9][0-9][0-9]-*.md' -exec basename {} \; | cut -c1-3 | sort -u)
INDEX=$(grep -oE '\[ADR-[0-9]{3}\]' docs/adr/README.md | grep -oE '[0-9]{3}' | sort -u)
diff <(printf '%s\n' "$BODY") <(printf '%s\n' "$INDEX")
```

본문과 인덱스의 번호 집합이 같아야 한다.
인덱스의 상대 링크도 모두 실제 파일을 가리켜야 한다.
번호가 비어 있으면 결번이므로 새 ADR에 그 번호를 배정하지 않는다.

### Drizzle 스키마

여러 줄로 작성된 `mysqlTable()` 선언도 잡도록 다중 행 검색을 사용한다.
문서에서는 테이블별 제목과 인증 테이블 표의 이름을 함께 읽는다.

```bash
set -eu
set -o pipefail
SCHEMA_TABLES=$(rg -U --no-filename -o 'mysqlTable\(\s*"[a-z_]+"' src/infra/db/schema/*.ts | rg -o '"[a-z_]+"' | sort -u)
DOC_TABLES=$(rg -o '^### `[a-z_]+`|^\| `auth_[a-z_]+`' docs/data-schema.md | rg -o '`[a-z_]+`' | tr -d '`' | sort -u)
diff <(printf '%s\n' "$SCHEMA_TABLES" | tr -d '"') <(printf '%s\n' "$DOC_TABLES")
```

테이블 이름뿐 아니라 컬럼의 null 허용, 고유성, 기본값, 인덱스도 코드와 문서를 대조한다.

### 페이지 문서

공개 페이지는 `docs/pages/`에 대응 문서를 가져야 한다.
관리자 로그인과 홈은 기존 `docs/flow.md`와 `docs/prd.md`에서 관리하며 별도 페이지 문서를 만들지 않는다.

문서 이름은 라우트 경로에서 유추되지 않는다.
`(blog)/page.tsx`는 `home.md`, `(blog)/series/page.tsx`는 `series-index.md`이고,
catch-all 라우트는 `-detail` 접미사를 쓴다.
`docs/pages/*.md` 중 `**File:**`로 대응 라우트를 밝힌 것은 일부뿐이라 코드에서 역추적할 수도 없다.
그래서 아래 표가 이 대응의 단일 소스다.

| 페이지 파일 | 페이지 문서 |
| --- | --- |
| `src/app/(blog)/page.tsx` | `docs/pages/home.md` |
| `src/app/(blog)/about/page.tsx` | `docs/pages/about.md` |
| `src/app/(blog)/categories/page.tsx` | `docs/pages/categories.md` |
| `src/app/(blog)/category/[...path]/page.tsx` | `docs/pages/category-detail.md` |
| `src/app/(blog)/contact/page.tsx` | `docs/pages/contact.md` |
| `src/app/(blog)/glossary/page.tsx` | `docs/pages/glossary.md` |
| `src/app/(blog)/posts/[...slug]/page.tsx` | `docs/pages/post-detail.md` |
| `src/app/(blog)/posts/latest/page.tsx` | `docs/pages/posts-latest.md` |
| `src/app/(blog)/posts/popular/page.tsx` | `docs/pages/posts-popular.md` |
| `src/app/(blog)/privacy/page.tsx` | `docs/pages/privacy.md` |
| `src/app/(blog)/series/page.tsx` | `docs/pages/series-index.md` |
| `src/app/(blog)/series/[name]/page.tsx` | `docs/pages/series-detail.md` |
| `src/app/(blog)/tag/[name]/page.tsx` | `docs/pages/tag.md` |
| `src/app/admin/login/page.tsx` | `docs/flow.md`, `docs/prd.md` |
| `src/app/admin/(protected)/page.tsx` | `docs/flow.md`, `docs/prd.md` |

표가 라우트 집합과 어긋났는지 먼저 확인한다.
개수 비교로는 라우트 추가와 문서 삭제가 상쇄돼 통과하므로 집합을 대조한다.

```bash
set -eu
set -o pipefail
ROUTES=$(find src/app -name 'page.tsx' -type f | sort)
TABLE=$(grep -E '^\| `src/app/' .claude/docs-check-overlay.md | cut -d'`' -f2 | sort -u)
diff <(printf '%s\n' "$ROUTES") <(printf '%s\n' "$TABLE")
```

차이가 있으면 표와 대응 문서를 함께 갱신한다.
`docs/pages/*.md`의 `Related Files` 또는 `File` 경로는 실제로 존재해야 한다.

### 레이어 경계

`AGENTS.md`의 “아키텍처 경계”를 판정 기준의 단일 소스로 삼는다.
경계 자체를 여기에 옮겨 적지 않는다.

## 판정

- `VIOLATION`: 코드 또는 운영 정책을 어기는 지침
- `UPDATE_NEEDED`: 오래됐거나 빠졌거나 중복된 문서
- `PASS`: 검사 범위와 근거를 제시하고 불일치가 없음

전체 점검은 부패, 과대화, 추론성, 중복, 자명성, 가독성의 6축을 모두 보고한다.
