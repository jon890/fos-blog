## ADR-004. 무한 스크롤 데이터 Fetching — API Route

**Context**: 무한 스크롤 추가 로드 API 수단 선택.

**Decision**: API Route (`/api/posts/latest`, `/api/posts/popular`).

**Why**: 표준 GET → 브라우저/CDN 캐시 + devtools 디버깅 용이. Server Action(POST 만 지원, 캐시 미활용)/Server Components+searchParams(전체 리렌더, URL 상태 미반영 결정과 충돌) 모두 기각. JSON 직렬화 경계는 `Date → ISO string` cursor 파싱 시 처리.
