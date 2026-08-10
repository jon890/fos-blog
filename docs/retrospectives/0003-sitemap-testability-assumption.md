---
id: RETRO-0003
plan: plan059-sitemap-dedup
date: 2026-08-10
phase: critic
status: 해결
category: 프로세스
promotion: 승격 안 함
---

# sitemap 테스트 가능성을 잘못 판단함

## 관찰

phase는 sitemap 조립 결과 테스트가 DB 접근을 요구한다고 판단해 배포 후 검사로 넘겼다.
critic은 `getRepositories`를 `vi.mock`하는 기존 테스트 선례로 DB 없이도 핵심 중복 제거를 검증할 수 있음을 확인했다.

## 원인

외부 의존성을 호출하는 모듈이라는 사실만 보고 테스트 격리가 불가능하다고 단정했다.
같은 의존성을 가리는 기존 테스트 패턴을 먼저 검색하지 않았다.

## 영향

sitemap URL 중복 제거가 누락되어도 로컬 검증이 통과하고 배포 후 검사에서만 드러날 계획이었다.
검증 cwd도 원본 저장소를 가리켜 현재 worktree 변경을 놓칠 수 있었다.

## 대응

phase에 `src/app/sitemap.test.ts`를 추가하고 현재 worktree를 검증 cwd로 고정했다.
Repository를 모의 객체로 바꿔 실제 DB 없이 sitemap 조립 결과와 실패 폴백을 검증했다.

## 검증

critic 재평가에서 `APPROVE`와 `BOUNDED` 판정을 받았다.
경로 유틸리티와 sitemap 대상 테스트 9개가 통과했다.

## 배운 점

외부 의존성이 있는 모듈의 테스트를 제외하기 전에 같은 의존성을 `vi.mock`하는 저장소 선례를 먼저 찾는다.

## 후속

첫 관측이며 기존 critic 평가 절차에서 검출됐으므로 공용 규칙으로 승격하지 않는다.
