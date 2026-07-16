# docs-check 오버레이 — fos-blog

공용 코어(`~/.claude/skills/docs-check`)에 fos-blog docs 구조·검증 세부를 채운다.
문서 책임 표(단일 소스 정의)는 `.claude/planning-overlay.md` 의 "docs 컨벤션" 표를 그대로 참조한다 (중복 작성 금지).

## docs 구조 + 대상 파일

```bash
# cwd: <repo root>
ls docs/*.md docs/pages/*.md .agents/skills/*/SKILL.md .agents/skills/_shared/*.md
find .claude/skills -maxdepth 1 -type l -print -exec test -e {} \;
```

- ADR 디렉터리: `docs/adr/`, INDEX 파일은 `docs/adr/README.md` (코어 예시의 `INDEX.md` 아님).
- 결번 ADR: **ADR-012** (사유는 `docs/adr/README.md` 참조). 새 ADR 에 재할당 금지.

## 검증 위임 — `fos-blog-docs-verifier` (필수)

6축 의미 검증 + 아래 grep 전체를 `fos-blog-docs-verifier` custom agent (`.claude/agents/fos-blog-docs-verifier.md`) 에 위임한다.
Codex 환경은 `.codex/agents/fos-blog-docs-verifier.toml`. agent 본문이 검증 항목·grep 명령·도메인 지식의 단일 소스 — main session 이 직접 grep 을 베끼면 정의가 두 곳으로 갈라진다.

```
Agent({
  subagent_type: "fos-blog-docs-verifier",
  description: "5-axis docs audit",
  prompt: "전체 docs (docs/*.md + docs/pages/*.md + .claude/skills/*/SKILL.md + _shared/*.md) 6축 점검. ADR Index 동기화 / 30줄 bloat / page.tsx ↔ docs/pages 정합 / Drizzle schema ↔ data-schema.md / 홈서버 배포 가드 / 매트릭스 용어 모두 자동 검증. Critical / Warning / Safe 분류 보고."
})
```

agent 사용 불가 환경에서만 아래 grep 을 main session 이 직접 실행한다.

## fos-blog 전용 부패 검사 grep

**Drizzle schema ↔ data-schema.md 테이블 일치**:
```bash
# cwd: <repo root>
SCHEMA_TABLES=$(grep -oE 'mysqlTable\("[a-z_]+"' src/infra/db/schema/*.ts | grep -oE '"[a-z_]+"' | sort -u)
DOC_TABLES=$(grep -oE '^### `[a-z_]+`' docs/data-schema.md | grep -oE '`[a-z_]+`' | sort -u)
diff <(echo "$SCHEMA_TABLES") <(echo "$DOC_TABLES") && echo "OK: data-schema sync"
```

**page.tsx ↔ docs/pages/{name}.md 정합**:
```bash
# cwd: <repo root>
ROUTES=$(find src/app -name "page.tsx" ! -path "*api*" ! -path "*\\(*" | sed 's|src/app/||;s|/page\.tsx||' | grep -vE '^\[|/\[' | sort)
DOCS=$(ls docs/pages/*.md 2>/dev/null | xargs -n1 basename | sed 's|\.md||' | sort)
# 신규 page.tsx 인데 docs/pages/{name}.md 부재 시 UPDATE_NEEDED
```

**page docs Related Files 정합** (경로 존재 확인):
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
  path="${line##*: }"; path="${path%% *}"
  test -e "$path" || echo "BROKEN: $line"
done
# 기대: "BROKEN:" 0건. 발견 시 (1) docs 행 제거 (2) 경로 수정 (3) 파일 복구 중 AskUserQuestion
```

**ADR 에 page docs 전용 헤딩 등장 여부** (문서 책임 표 위반 — B2 옵션):
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
# 기대: 0건 — 발견 시 해당 정보를 docs/pages/{page}.md 로 이전 + ADR 에는 결정 근거만 남김
```

**홈서버 배포 가드** (Vercel-only 기능 권장 검출):
```bash
grep -rnE "Vercel Cron|Edge Functions|vercel\.json" docs/ CLAUDE.md README.md 2>/dev/null && echo "VIOLATION: Vercel-only 기능 권장 docs 에 등장"
```

**ADR Index 동기화 + bloat** (INDEX 파일 = `docs/adr/README.md`):
```bash
# cwd: <repo root>
BODY=$(ls docs/adr/[0-9]*.md | grep -oE '[0-9]{3}' | sort -u | sed 's/^/ADR-/')
INDEX=$(grep -oE '\[ADR-[0-9]+\]' docs/adr/README.md | grep -oE 'ADR-[0-9]+' | sort -u)
diff <(echo "$BODY") <(echo "$INDEX") && echo "OK: ADR Index synced"

for f in docs/adr/[0-9]*.md; do
  n=$(basename "$f" | grep -oE '^[0-9]+')
  size=$(wc -l < "$f" | tr -d ' ')
  [ "$size" -gt 30 ] && echo "BLOAT: ADR-$n ($size lines, > 30) — 슬림화 검토"
done
```

## common-pitfalls / 문서 책임

- common-pitfalls 경로: `.agents/skills/_shared/common-pitfalls.md` (`.claude/skills/_shared` 는 symlink).
- 문서 책임 표(단일 소스) + ADR 자명성 게이트 + 거울 구조 원칙: `.claude/planning-overlay.md` 참조.

## build-with-teams 연계

파이프라인 내부 docs-verifier(현재 task 범위만) 와 이 스킬(전체 docs 6축) 의 역할 분담은 코어 "task 범위 검증과의 분담" 절 그대로 적용한다. fos-blog 는 양쪽 모두 `fos-blog-docs-verifier` 로 위임한다는 점만 추가.
