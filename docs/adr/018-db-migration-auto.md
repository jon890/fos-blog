## ADR-018. DB 마이그레이션 자동화 — 컨테이너 부팅 시 drizzle migrator 실행

**Context**: 현재 `start.sh` 가 `docker compose up -d` 만 호출 → 매 배포마다 사용자가 수동으로 `pnpm db:migrate` 실행. plan006 의 `0004_cleanup_stale_visits` 같은 마이그레이션이 자동 적용 안 됨 → 운영 누락 위험.

**Decision**: production 이미지에 `scripts/migrate.js` 포함 + Dockerfile CMD 를 `node migrate.js && node server.js` 로 교체. 컨테이너 부팅 시 미적용 마이그레이션 자동 apply.

- 스크립트: `drizzle-orm/mysql2/migrator` 의 `migrate()` 사용 — drizzle-kit CLI 미포함 가능 (production deps 만으로 실행)
- 이미지에 `drizzle/` 디렉터리 + 빌드된 `migrate.js` 복사
- 적용 idempotent: drizzle journal (`__drizzle_migrations` 테이블) 이 이미 적용된 마이그레이션 skip
- 부팅 시간: 신규 마이그레이션 0개면 ~수백 ms 추가, 1개 이상이면 SQL 크기에 비례

**Why**:

- **운영 안정성**: 배포 자동화 = 인적 누락 차단
- **drizzle-kit 미포함**: drizzle-orm 의 migrator 만 production deps 로 충분 → 이미지 크기 영향 0
- **Idempotency 보장**: 매 부팅마다 실행해도 안전
- 별도 init container(`docker-compose depends_on`) 도 가능하지만 단일 컨테이너 인라인이 더 단순. 복잡도 낮은 1인 운영 환경에 적합

**Follow-up**: 다중 인스턴스 환경 도달 시 마이그레이션 락(분산) 검토. 현재 1 인스턴스라 불필요.
