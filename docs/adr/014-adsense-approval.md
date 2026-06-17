## ADR-014. AdSense 승인 — 정책/소개 페이지 + GitHub 프로필

**Context**: AdSense 승인 신청에 Privacy Policy 필수, About/Contact 권장.

**Decision**:

- **신규 페이지 3개**: `/privacy`, `/about`, `/contact` (indexable, 푸터 노출, sitemap 반영)
- Terms of Service 제외 (블로그 규모 오버엔지니어링)
- **About**: GitHub `jon890` 프로필 런타임 fetch + ISR 1시간. 실패 시 텍스트 fallback + BLG2 로그. `next.config.ts` 에 `avatars.githubusercontent.com` 추가
- **Contact**: 이메일 `jon89071@gmail.com` + GitHub Issues `jon890/fos-study/issues`
- **Privacy 톤**: 평이한 한국어. 수집 항목 명시 — IP SHA-256 해시(`visit_logs`), 댓글 닉네임/bcrypt 비밀번호(IP 미수집), 테마 localStorage, AdSense 쿠키. GA 미사용

**Why**: 승인 반려의 최빈 사유는 Privacy 부재. `src/app/ads.txt/route.ts` 동적 route 기구현 → 승인 후 env publisher ID 입력만으로 작동. About 하드코딩(프로필 변경 시 재빌드)/build-time fetch(빌드 실패 시 페이지 깨짐) 기각. GA4 도입 시 Privacy 개정 필요.

**도메인 신청 단위**: AdSense 는 루트 도메인(`fosworld.co.kr`) 으로만 신청 가능 — 서브도메인(`blog.*`) 단독 입력 불가. 등록 정책: 루트 승인 → 사이트 메뉴에서 서브도메인 추가 → 별도 심사 없이 광고 노출.

**신청 전략**: 현재 ADR-013 의 301 리디렉션을 **그대로 두고** `fosworld.co.kr` 신청. AdSense 봇이 redirect 추적 후 `blog.*` 콘텐츠를 평가할 가능성이 높음. 거절 시 `6.conf` 의 `location /` 을 임시 `proxy_pass` 환원(양도메인 동일 서빙) → 재신청 → 승인 후 301 복구. 절차/롤백은 `docs/adsense-checklist.md` 섹션 2 참조.
