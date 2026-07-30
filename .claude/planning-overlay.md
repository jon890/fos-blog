# planning 오버레이 — fos-blog

공용 코어(`~/.claude/skills/planning`)에 fos-blog 특화를 주입한다.
코어의 8단계 skeleton 을 이 레포의 도메인(Next.js UI 블로그)·docs 컨벤션·검증에 맞춰 채운다.

## 도메인: UI (Next.js / React)

- **3단계 (사용자 흐름)**: 시니어 UX 리서처 관점. 화면 전환·사용자 액션·시스템 반응을 구체화. 엣지 케이스(에러/빈 상태/권한).
- **4단계 (화면/인터페이스)**: 각 화면의 정보·기능 체크리스트, 컴포넌트 구조 초안, 상태 관리 방식.
- **5단계 (API)**: Server Action vs API Route vs gRPC vs CLI command 판단. 요청/응답 스키마, 스트리밍 필요 여부.
