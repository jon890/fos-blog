# 소개 페이지

**Route:** `/about`
**진입점:** [About 페이지](../../src/app/(blog)/about/page.tsx)

## 목적과 구성

작성자 프로필, 사이트 통계, 기술 스택과 외부 링크를 제공한다.
프로필 이미지를 표시하지 못해도 이니셜을 읽을 수 있게 두 층으로 구성한다.
이 배치의 이유는 [ADR-022](../adr/022-about-page.md), 스타일은
[About CSS](../../src/app/(blog)/about/about.css)가 소유한다.

## 데이터와 실패 처리

| 조회 | 정상 동작 | 실패 처리 |
| --- | --- | --- |
| GitHub 프로필 | Bearer 인증으로 공개 프로필 요청, fetch `revalidate = 3600` | 401·403이면 무인증으로 즉시 재요청하며 그 fetch는 `revalidate = 60`. 최종 실패나 예외는 대체 프로필 표시 |
| 사이트 통계 | 활성 글 수, 주 카테고리 수, 활성 글의 가장 최근 수정 시각 조회 | 조회 실패 시 글·카테고리 수는 0, 최근 시각은 null |
| 기술 스택·외부 링크 | 페이지의 정적 정의 | 외부 조회 없음 |

재요청의 60초는 캐시 갱신 설정이며 재시도 전 대기 시간이 아니다.
프로필 정책은 [GitHubProfileService](../../src/services/GitHubProfileService.ts),
통계 계산은 [StatsService](../../src/services/StatsService.ts)가 담당한다.

## 갱신

페이지의 `revalidate = 3600`을 사용한다.
