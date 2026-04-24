# Deployment — 홈서버 배포 가이드

**작성일:** 2026-04-24

fos-blog 는 홈서버(Docker + Next.js standalone + nginx reverse proxy) 환경에서 운영된다. 이 문서는 배포 시 반복되는 수동 절차를 체크리스트로 정리한다.

---

## 도메인 구조 (ADR-011)

- **메인**: `https://blog.fosworld.co.kr` — Next.js 앱 서빙
- **루트 `fosworld.co.kr`**: `/ads.txt` 만 예외 서빙, 나머지는 `blog.fosworld.co.kr` 로 301 리디렉션

---

## 배포 절차

### 1. 환경 변수 (`.env.production`)

```env
NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr
GITHUB_TOKEN=...
GITHUB_OWNER=jon890
GITHUB_REPO=fos-study
DATABASE_URL=mysql://fos_user:...@localhost:13307/fos_blog
SYNC_API_KEY=...
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
NEXT_PUBLIC_GOOGLE_ADSENSE_ID=ca-pub-...   # AdSense 승인 후 입력
```

`NEXT_PUBLIC_SITE_URL` 값이 canonical / sitemap / OG / Article JSON-LD 에 자동 반영된다. 코드 전체에 하드코딩된 도메인 없음.

### 2. 빌드 + 컨테이너 재기동

```bash
# cwd: <repo root>
docker build -t fos-blog .
docker stop fos-blog 2>/dev/null || true
docker rm fos-blog 2>/dev/null || true
docker run -d --name fos-blog -p 3000:3000 --env-file .env.production fos-blog
```

### 3. DB 마이그레이션 (스키마 변경 시)

```bash
pnpm db:migrate
```

`db:push` 는 금지 (CLAUDE.md BLG1).

---

## nginx 설정

### `/etc/nginx/sites-available/fosworld.co.kr`

```nginx
# blog.fosworld.co.kr — 메인 앱
server {
  listen 443 ssl http2;
  server_name blog.fosworld.co.kr;

  ssl_certificate     /etc/letsencrypt/live/blog.fosworld.co.kr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/blog.fosworld.co.kr/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# fosworld.co.kr — /ads.txt 예외 + 나머지는 301 → blog.*
server {
  listen 443 ssl http2;
  server_name fosworld.co.kr;

  ssl_certificate     /etc/letsencrypt/live/fosworld.co.kr/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/fosworld.co.kr/privkey.pem;

  # AdSense 루트 도메인 ads.txt 정책 충족 — 실제 파일 서빙 (리디렉션 X)
  # blog.fosworld.co.kr/ads.txt 로 proxy_pass 해서 동적 route 결과를 루트에서도 사용
  location = /ads.txt {
    proxy_pass http://127.0.0.1:3000/ads.txt;
    proxy_set_header Host blog.fosworld.co.kr;
  }

  location / {
    return 301 https://blog.fosworld.co.kr$request_uri;
  }
}

# http → https 강제 (두 도메인 공통)
server {
  listen 80;
  server_name blog.fosworld.co.kr fosworld.co.kr;
  return 301 https://$host$request_uri;
}
```

### 적용

```bash
sudo nginx -t                 # 설정 검증
sudo systemctl reload nginx   # 무중단 reload
```

### SSL 인증서 (Let's Encrypt)

두 도메인 모두 발급되어 있어야 한다:

```bash
sudo certbot --nginx -d blog.fosworld.co.kr -d fosworld.co.kr
```

자동 갱신 확인:

```bash
sudo systemctl status certbot.timer
```

---

## Google Search Console 수동 작업

도메인 전환 후 1회:

1. **새 sitemap 제출**: GSC → 사이트맵 → `https://blog.fosworld.co.kr/sitemap.xml` 추가
2. 기존 `fosworld.co.kr` sitemap 엔트리 제거 (301 로 자동 무효화되지만 명시적 제거 권장)
3. **URL 검사**: 대표 URL 2~3개 로 "색인 요청" 실행 (속도 가속)
4. **Coverage / Indexed Pages** 2~4주 관찰

Domain property (DNS TXT 인증) 기준이므로 서브도메인 property 별도 등록 불필요.

---

## 배포 체크리스트

| 단계 | 명령 / 확인 |
|---|---|
| 1. env 업데이트 | `.env.production` 의 `NEXT_PUBLIC_SITE_URL` 확인 |
| 2. 이미지 빌드 | `docker build -t fos-blog .` |
| 3. DB 마이그레이션 | `pnpm db:migrate` (변경 시만) |
| 4. 컨테이너 교체 | `docker stop && rm && run` |
| 5. nginx reload | `sudo nginx -t && sudo systemctl reload nginx` |
| 6. 리디렉션 검증 | `curl -I https://fosworld.co.kr/posts/database/mysql/innodb-architecture.md` → `301 Location: https://blog.fosworld.co.kr/...` |
| 7. ads.txt 검증 | `curl https://fosworld.co.kr/ads.txt` → 동일 결과 `curl https://blog.fosworld.co.kr/ads.txt` |
| 8. 앱 헬스체크 | `curl https://blog.fosworld.co.kr/` → 200 |
| 9. GSC 새 sitemap 제출 | GSC 콘솔에서 수동 |
| 10. AdSense ID 업데이트 (승인 후) | `.env.production` + 재배포 |

---

## 롤백

nginx 설정 변경이 문제면:

```bash
sudo nginx -T > /dev/null 2>&1 || sudo systemctl reload nginx  # 검증 실패 시 reload 중단
# 이전 설정 복원
sudo cp /etc/nginx/sites-available/fosworld.co.kr.bak /etc/nginx/sites-available/fosworld.co.kr
sudo systemctl reload nginx
```

docker 컨테이너 롤백:

```bash
docker run -d --name fos-blog -p 3000:3000 --env-file .env.production fos-blog:<previous-tag>
```

---

## 참고

- ADR-011 — 도메인 전환 결정 근거
- ADR-012 — AdSense 승인 요건
- `src/app/ads.txt/route.ts` — ads.txt 동적 생성 (env 기반)
