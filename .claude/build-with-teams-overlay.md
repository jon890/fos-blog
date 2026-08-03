# build-with-teams 오버레이 — fos-blog

공용 코어(`~/.claude/skills/build-with-teams`)에 fos-blog의 task 탐색과 이어서 작업 규칙을 주입한다.
검증 명령, worktree 환경 준비, 역할 정의는 `CLAUDE.md`와 전용 agent 파일을 따른다.

## task와 브랜치 연결

- `tasks/{plan}/index.json`을 먼저 찾는다.
- 정확히 일치하지 않으면 `tasks/{plan}-*/index.json` 형태의 슬러그 포함 경로를 찾는다.
- 후보가 둘 이상이면 자동 선택하지 않고 현재 환경의 질문 도구로 대상을 확인한다.
- planning이 만든 원격 `plan{N}-<slug>` 브랜치에 구현 커밋을 이어 붙여 하나의 PR로 끝낸다.
- task 문서만 담긴 PR이 이미 열려 있으면 새 브랜치를 만들지 않고 그 PR을 구현 결과 PR로 갱신한다.
- task 브랜치가 이미 머지된 경우에만 최신 `main`에서 구현 브랜치를 새로 만든다.

브랜치 이름과 환경 준비 명령은 `CLAUDE.md`의 "Git과 PR", "환경 변수" 절을 단일 소스로 삼는다.
