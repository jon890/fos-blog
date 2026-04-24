# AdSense 승인 체크리스트

**작성일:** 2026-04-24
**관련 ADR**: [ADR-014](./adr.md#adr-014)

Google AdSense 승인 신청 → 승인 → 광고 노출까지의 절차와 체크리스트.

---

## 0. 사전 조건 (plan004 완료 후)

- [ ] `blog.fosworld.co.kr` 메인 도메인 전환 완료 (ADR-013)
- [ ] `https://blog.fosworld.co.kr/sitemap.xml` GSC 제출 완료
- [ ] `https://blog.fosworld.co.kr/robots.txt` 접근 가능

---

## 1. 기술 준비 (plan005 완료 후)

- [ ] `/privacy` — 개인정보처리방침 페이지 (indexable, 푸터 링크)
- [ ] `/about` — 블로그 소개 (GitHub 프로필 연동)
- [ ] `/contact` — 연락처 (이메일 + GitHub Issues)
- [ ] 푸터에 정책 페이지 링크 노출
- [ ] `sitemap.xml` 에 3개 페이지 포함
- [ ] `src/app/ads.txt/route.ts` 동작 확인 (env 없이도 `# ads.txt not configured` 반환)

---

## 2. AdSense 신청

1. https://www.google.com/adsense/start/ 접속
2. **사이트 URL**: `https://blog.fosworld.co.kr` 입력 (주의: `blog.` 서브도메인 포함)
3. 국가/지역: 대한민국
4. 결제 수단 등록 (SWIFT 계좌)
5. **AdSense 스크립트 삽입** — 이미 `src/app/layout.tsx:126-133` 에 구현됨. `NEXT_PUBLIC_GOOGLE_ADSENSE_ID` env 를 임시 publisher ID(승인 과정에서 Google 제공) 로 채우고 재배포
6. "검토 요청" 제출

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

### 4.2. ads.txt 검증

```bash
curl https://blog.fosworld.co.kr/ads.txt
# 기대: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0

curl https://fosworld.co.kr/ads.txt
# 기대: 동일 내용 (nginx proxy_pass 로 루트 도메인에서도 제공)
```

AdSense 관리 페이지에서 "ads.txt 감지됨" 표시 확인 (최대 24시간 소요).

### 4.3. 광고 단위 배치

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
