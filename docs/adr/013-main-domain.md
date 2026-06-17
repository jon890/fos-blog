## ADR-013. 메인 도메인 단일화 — `blog.fosworld.co.kr`

**Context**: `fosworld.co.kr` + `blog.fosworld.co.kr` 가 같은 앱을 서빙 → GSC "대체 페이지" 10개 분류, 크롤 예산 분산. 두 도메인 병행 운영의 SEO 손해 해소가 주요 동기.

**Decision**: `blog.fosworld.co.kr` 메인 단일화. `fosworld.co.kr` 은 **`/ads.txt` 만 예외 서빙**, 나머지는 `blog.*` 로 301.

- `NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr` → canonical/sitemap/OG/JSON-LD 자동 재생성 (코드 하드코딩 0)
- 홈서버 NPM(`fos-npm` 컨테이너) Custom: `location = /ads.txt` proxy + `location /` `return 301`
- GSC Domain property (DNS TXT) 가 서브도메인 자동 커버. 새 sitemap 수동 제출

**Why**: canonical 분산 해소 + AdSense `ads.txt` 루트 정책 호환 + 브랜드 명확화. 반대 방향(`fosworld.co.kr` 메인) 은 기술적으로 동등하지만 `blog.*` 브랜드 의도. 두 도메인 병행(크롤 예산 낭비)/별도 앱(과도) 기각. 도메인 전환 후 2~4주 SEO 변동 감수 — 301 이 자동 연결.

**AdSense 정책 상호작용**: AdSense 신청 단위는 루트 도메인(`fosworld.co.kr`). 봇이 301 추적 후 `blog.*` 콘텐츠를 평가하는 시나리오로 **현재 301 그대로 신청 → 승인 시 AdSense 사이트 메뉴에서 `blog.*` 서브도메인 추가**. 거절될 경우 fallback: `6.conf` 의 `location /` 을 임시 `proxy_pass` 로 환원해 양도메인 동일 서빙 → 재신청 → 승인 후 다시 301 복구. (ADR-014)
