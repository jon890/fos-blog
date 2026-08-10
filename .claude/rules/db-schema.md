---
paths:
  - "src/infra/db/**"
  - "drizzle/**"
---

# DB 스키마 변경

1. `src/infra/db/schema/`를 수정한다.
2. `pnpm db:generate`로 `drizzle/` 산출물을 만든다.
3. 생성 SQL을 직접 편집하지 말고 파괴적 변경 여부를 검토한다.
4. 스키마 변경과 생성된 마이그레이션을 같은 커밋에 포함한다.
5. `pnpm db:migrate` 또는 `pnpm db:migrate:runtime`으로 적용을 검증한다.

프로덕션에 `pnpm db:push`를 사용하지 않는다.
`pnpm db:push`는 버려도 되는 로컬 실험에만 허용하며 커밋 전에 마이그레이션으로 바꾸거나 되돌린다.
컨테이너는 시작할 때 `migrate.js`를 실행한 뒤 `server.js`를 실행한다.
