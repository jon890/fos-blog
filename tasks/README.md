# tasks/

`plan-and-build` / `build-with-teams` 스킬이 사용하는 phase 기반 작업 디렉터리.

## 구조

```
tasks/
  {planNNN}-{short-slug}/
    index.json          # phase 목록 + 상태 (pending/in_progress/completed/failed)
    phase-01.md         # 각 phase는 자기완결적 프롬프트
    phase-02.md
    ...
```

## 생성 방식

`.claude/skills/planning/SKILL.md`의 8단계로 설계 → `.claude/skills/plan-and-build/SKILL.md`의 phase 분할 원칙에 따라 파일 생성.
index.json + phase 파일은 **실행 전에** 반드시 git 커밋한다.

## 실행 방식

```bash
# cwd: 레포 루트
python scripts/run-phases.py tasks/{planNNN}-{slug}/
```

또는 `build-with-teams` 스킬로 team-lead/critic/executor/code-reviewer/docs-verifier 4-게이트 파이프라인 실행.

## 규칙 요약

- 각 phase 작업 항목 **5개 이하**
- 성공 기준은 반드시 **기계 명령**(grep/test/diff) — "눈으로 확인" 금지
- 모든 Bash 블록 앞에 `# cwd: ...` 주석
- 수치/파일 범위는 `git diff --stat` / `git diff --name-only` 실측 인용

상세 규칙: `CLAUDE.md` "Agent Operating Rules" + `.claude/skills/_shared/common-critic-patterns.md`
