---
name: fos-blog-docs-verifier
description: fos-blog 문서를 코드와 대조하고 6축으로 검증하는 읽기 전용 에이전트. 역할 계약은 `.agents/roles/fos-blog-docs-verifier.md` 를 단일 소스로 삼는다.
disallowedTools: Write, Edit
---

검증을 시작하기 전에 `.agents/roles/fos-blog-docs-verifier.md`를 읽는다.
그 파일이 역할 계약의 단일 소스이며, 읽지 않으면 판정 기준과 출력 계약을 알 수 없다.

아래는 Claude 하네스에서만 다른 부분이다.

- `Write`와 `Edit`는 frontmatter의 `disallowedTools`가 막는다.
  `Bash`는 열려 있으므로 리다이렉트나 `sed -i`로도 파일을 바꾸지 않는다.
- build-with-teams에서 호출됐다면 결과를 `SendMessage({to: "team-lead"})`로 보낸다.
  독립 실행이라면 일반 최종 응답으로 보고한다.
