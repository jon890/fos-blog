# AdSense 승인 체크리스트

**작성일:** 2026-04-24
**관련 ADR**: [ADR-014](./adr.md#adr-014)

Google AdSense 승인 신청 → 승인 → 광고 노출까지의 절차와 체크리스트.

---

## 0. 사전 조건 (plan004 완료 — 2026-04-24 merged)

- [x] `blog.fosworld.co.kr` 메인 도메인 전환 완료 (ADR-013)
- [x] `https://blog.fosworld.co.kr/sitemap.xml` GSC 제출 완료
- [x] `https://blog.fosworld.co.kr/robots.txt` 접근 가능

---

## 1. 기술 준비 (plan005 완료 — 2026-04-24)

- [x] `/privacy` — 개인정보처리방침 페이지 (indexable, 푸터 링크)
- [x] `/about` — 블로그 소개 (GitHub 프로필 연동)
- [x] `/contact` — 연락처 (이메일 + GitHub Issues)
- [x] 푸터에 정책 페이지 링크 노출
- [x] `sitemap.xml` 에 3개 페이지 포함
- [x] `src/app/ads.txt/route.ts` 동작 확인 (env 없이도 `# ads.txt not configured` 반환)

---

## 2. AdSense 신청

> **신청 단위 = 루트 도메인**: AdSense 는 등록 도메인(`fosworld.co.kr`) 단위로만 신청 가능. `blog.fosworld.co.kr` 같은 서브도메인 단독 입력은 거부됨. 루트 도메인 승인 후 서브도메인을 별도 추가하는 정책. (자세히는 [ADR-014](./adr.md#adr-014))

1. https://www.google.com/adsense/start/ 접속
2. **사이트 URL**: `https://fosworld.co.kr` 입력 (루트 도메인)
3. 국가/지역: 대한민국
4. 결제 수단 등록 (SWIFT 계좌)
5. **AdSense 스크립트 삽입** — 이미 `src/app/layout.tsx:126-133` 에 구현됨. `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` env 를 임시 publisher ID(승인 과정에서 Google 제공) 로 채우고 재배포
6. "검토 요청" 제출

### 승인 봇과 nginx 301 의 상호작용

ADR-013 으로 `fosworld.co.kr` 의 모든 경로(`/ads.txt` 제외) 가 → 301 → `blog.fosworld.co.kr` 로 리디렉션됨. AdSense 봇은 일반적으로 301 follow 후 target 콘텐츠를 평가하지만 공식 명문화는 없음.

- **승인 시**: AdSense 봇이 redirect 추적 후 `blog.*` 콘텐츠를 정상 평가 → 통과
- **거절 시 (사유: redirect-only / 콘텐츠 부족)**: nginx `6.conf` 의 `location /` 의 `return 301` 을 `include conf.d/include/proxy.conf;` 로 임시 환원 → 양 도메인 동일 서빙 → 재신청. 승인 후 다시 301 으로 복구

---

## 3. 승인 대기 (1~2주)

Google 이 사이트 크롤 → 정책 준수 확인:

- 오리지널 콘텐츠 품질
- Privacy Policy 존재 여부 (필수)
- 사용자 경험 (탐색/모바일)
- 저작권 위반 없음
- 사이트 트래픽 (소량이라도 필요)

### 자주 반려되는 이유

| 사유 | 해결 |
|---|---|
| **Privacy Policy 없음** | `/privacy` 페이지 존재 + 푸터 링크 확인 |
| **콘텐츠 부족** | 최소 20~30개 글 권장 (현재 200개 — 충분) |
| **탐색 어려움** | 카테고리/검색/sitemap 동작 확인 |
| **사이트 오류/접근 불가** | 승인 심사 기간 중 다운타임 최소화 |
| **AdSense 스크립트 누락** | `layout.tsx` head 에 스크립트 정상 로드 확인 |
| **준비되지 않은 사이트** | About/Contact 페이지 필수 |

---

## 4. 승인 후

### 4.1. Publisher ID 반영

Google 이 발급한 `ca-pub-XXXXXXXXXXXXXXXX` 를 `.env.production` 에 설정:

```env
NEXT_PUBLIC_GOOGLE_ADSENSE_ID=ca-pub-XXXXXXXXXXXXXXXX
```

재배포 → `src/app/ads.txt/route.ts` 동적 route 가 `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` 반환.

### 4.2. 서브도메인 추가

승인된 루트 도메인에 서브도메인 추가 (별도 심사 없이 광고 노출 가능):

1. AdSense 콘솔 → 사이트 메뉴 → `fosworld.co.kr` 선택
2. "서브도메인 추가" → `blog.fosworld.co.kr` 입력
3. 광고 코드는 이미 layout.tsx 에 삽입됨 → 자동 노출

### 4.3. ads.txt 검증

```bash
curl https://fosworld.co.kr/ads.txt
# 기대: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
# (AdSense 가 이 위치에서 fetch — 루트 도메인 정책)

curl https://blog.fosworld.co.kr/ads.txt
# 기대: 동일 내용 (서브도메인도 같은 동적 route)
```

AdSense 관리 페이지에서 "ads.txt 감지됨" 표시 확인 (최대 24시간 소요).

### 4.4. 광고 단위 배치

별도 plan 으로 진행 예정 (이 범위 아님):
- Page-level ads (자동 광고) vs 수동 광고 단위 배치
- 글 상세 본문 inline / sidebar / header / footer
- AMP 광고 (현재 미해당 — AMP 미사용)

---

## 5. 유지보수

- AdSense 정책 주기 검토 (Google 정책 개정 시 알림 구독)
- Privacy Policy 개정 시 `/privacy` 페이지 업데이트 (GA 도입 등 수집 항목 변경 시)
- `ads.txt` 는 env 변경으로 자동 갱신 — 별도 파일 관리 불필요

---

## 참고 링크

- [AdSense 프로그램 정책](https://support.google.com/adsense/answer/48182)
- [ads.txt 가이드](https://support.google.com/adsense/answer/7532444)
- [서브도메인 광고 노출](https://support.google.com/adsense/answer/10162) — 루트 승인 시 서브도메인 자동 커버 (반대도 가능)
