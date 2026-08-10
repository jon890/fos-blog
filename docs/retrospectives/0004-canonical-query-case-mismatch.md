---
id: RETRO-0004
plan: plan059-sitemap-dedup
date: 2026-08-10
phase: docs-verifier
status: 해결
category: 결함
promotion: 승격 안 함
---

# canonical 표기와 폴더 조회의 대소문자 규칙이 어긋남

## 관찰

sitemap과 canonical은 카테고리 경로를 소문자로 만들었다.
그러나 `FolderRepository.getFolderContents`의 글 경로 접두사 비교는 JavaScript `startsWith`를 사용해 대소문자를 구분했다.

## 원인

계획은 MySQL 문자열 비교가 대소문자를 구분하지 않는다는 사실을 폴더 조회 전체에 적용했다.
DB 조회 뒤 JavaScript에서 다시 수행하는 글 경로 필터를 확인하지 않았다.

## 영향

저장 경로가 `AI/...`일 때 대표 URL인 `/category/ai`가 글을 누락할 수 있다.
서로 다른 내용을 같은 canonical로 묶으면 검색엔진이 불완전한 페이지를 대표로 선택할 수 있다.

## 대응

`FolderRepository.getFolderContents`가 요청 경로와 저장 글 경로를 소문자로 바꾼 뒤 접두사를 비교하게 했다.
요청 `folderPath`와 화면 표시용 `pathSegments`는 바꾸지 않아 canonical 생성 이외의 URL 표기 동작을 유지했다.
ADR과 phase의 조회 전제와 화면 표기 설명도 실제 코드에 맞게 바로잡았다.

## 검증

문서 정합성 검증이 `VIOLATION`으로 판정했다.
`"AI/agent/intro.md".startsWith("ai/")`가 `false`임을 실측했다.
대소문자 양방향 조회와 `aiops` 접두사 오탐 방지 테스트가 통과했다.

## 배운 점

URL 표기를 정규화할 때는 URL 생성뿐 아니라 대표 URL로 다시 조회한 콘텐츠가 기존 표기와 같은지도 검증해야 한다.

## 후속

첫 관측이며 독립 문서 정합성 검증에서 검출됐으므로 공용 규칙으로 승격하지 않는다.

## 해결 결과

대표 URL과 원본 표기 URL이 같은 폴더 글을 반환하도록 조회 비교를 맞췄다.
docs-verifier 재검증 결과를 이 회고의 최종 근거로 남긴다.

## 재검토 발견

코드 재검토에서 교차 카테고리 조회의 `JSON_CONTAINS`도 JSON 문자열의 대소문자를 구분함을 확인했다.
직접 폴더 글은 같아졌지만 `categories: ["AI"]`인 교차 게시 글은 `/category/ai`에서 여전히 누락될 수 있었다.

이 회고를 다시 진행 중으로 열고 교차 카테고리 비교와 문서를 함께 보완한다.

## 최종 해결 결과

저장된 교차 카테고리 배열과 요청 경로를 소문자로 맞춘 뒤 `JSON_CONTAINS`로 정확 비교하게 했다.
MySQL 읽기 전용 검사에서 `AI`와 `ai`는 모두 일치하고 `AIOps`는 일치하지 않음을 확인했다.

직접 폴더 글과 교차 게시 글이 모두 대표 URL에서 동일하게 조회된다.
재검토에서 발견된 조회 지점을 모두 보완했으므로 이 회고를 해결 상태로 닫고 공용 규칙으로 승격하지 않는다.
