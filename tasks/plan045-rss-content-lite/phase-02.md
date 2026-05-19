# Phase 02 — 회귀 테스트 + 통합 검증 + index.json completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase 01 의 lite path 구현이 정합인지 회귀 테스트로 보호. `pnpm lint` / `type-check` / `test` / `build` 전체 통과 + index.json 마킹.

**범위 외**: 새 변경 추가 (phase 01 의 작업).

---

## 작업 항목 (3)

### 1. `src/services/RSSService.test.ts` — getRecentForFeedLite 회귀

(파일이 없으면 신규 생성. RSSService 가 단순 wrapper 라 mock repository 로 충분.)

```ts
import { describe, it, expect, vi } from "vitest";
import { createRSSService } from "./RSSService";

describe("RSSService.getRecentForFeedLite (plan045)", () => {
  it("repo.getRecentActiveLite 결과를 그대로 반환", async () => {
    const mockData = [
      { title: "A", path: "x/a.md", slug: "a", category: "tech", subcategory: null, folders: [], description: "desc A", createdAt: new Date() },
      { title: "B", path: "x/b.md", slug: "b", category: "tech", subcategory: null, folders: [], description: null, createdAt: new Date() },
    ];
    const repos = {
      post: {
        getRecentActive: vi.fn(),
        getRecentActiveLite: vi.fn().mockResolvedValue(mockData),
      },
    };
    const service = createRSSService(repos);
    const result = await service.getRecentForFeedLite({ limit: 50 });
    expect(repos.post.getRecentActiveLite).toHaveBeenCalledWith({ limit: 50 });
    expect(result).toBe(mockData);
  });

  it("limit 미지정 시 50 기본값", async () => {
    const repos = {
      post: {
        getRecentActive: vi.fn(),
        getRecentActiveLite: vi.fn().mockResolvedValue([]),
      },
    };
    const service = createRSSService(repos);
    await service.getRecentForFeedLite();
    expect(repos.post.getRecentActiveLite).toHaveBeenCalledWith({ limit: 50 });
  });

  it("기존 getRecentForFeed 는 그대로 동작 (회귀 보호)", async () => {
    const mockData = [{ title: "A", path: "x/a.md", slug: "a", category: "tech", subcategory: null, folders: [], description: "d", content: "full md", createdAt: new Date() }];
    const repos = {
      post: {
        getRecentActive: vi.fn().mockResolvedValue(mockData),
        getRecentActiveLite: vi.fn(),
      },
    };
    const service = createRSSService(repos);
    const result = await service.getRecentForFeed({ limit: 10 });
    expect(repos.post.getRecentActive).toHaveBeenCalledWith({ limit: 10 });
    expect(result).toBe(mockData);
  });
});
```

핵심:
- mock repository — vitest `vi.fn()` 으로 단순. integration 은 OOS (PostRepository 의 SQL 은 별도)
- 3 케이스 — lite 정상 / limit 기본값 / 기존 메서드 보존

### 2. PostRepository 의 select 컬럼 정합 (BLG15 검증 — 정적 검사)

```bash
# cwd: <repo root>

# getRecentActiveLite 의 select 객체에 content 가 포함되어 있지 않은지
awk '
  /async getRecentActiveLite/ { in_method=1; next }
  in_method && /\.select\(\{/ { in_select=1; next }
  in_select && /\}\)/ { in_select=0; in_method=0; next }
  in_select && /content:/ { print "FAIL: getRecentActiveLite 에 content select" }
' src/infra/db/repositories/PostRepository.ts
# 기대: 출력 없음

# 반환 타입 Pick 에도 content 없는지
grep -A 12 "async getRecentActiveLite" src/infra/db/repositories/PostRepository.ts | grep -c '"content"'
# 기대: 0
```

### 3. 통합 검증 + 마킹

```bash
# cwd: <repo root>
pnpm lint
pnpm type-check
pnpm test --run
pnpm build
# 모두 exit 0 + RSSService 3 케이스 PASS

# index.json 마킹
sed -i '' 's/"status": "pending"/"status": "completed"/g' tasks/plan045-rss-content-lite/index.json
grep -c '"status": "completed"' tasks/plan045-rss-content-lite/index.json
# 기대: 3 (1 root + 2 phases)
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `src/services/RSSService.test.ts` | 신규 또는 기존 파일에 케이스 3개 추가 |
| `tasks/plan045-rss-content-lite/index.json` | status 마킹 (pending → completed) |

## 검증

위 "통합 검증" 명령 + Vitest 3 케이스 PASS + BLG15 정적 검사 통과 시 PASS.

## 의도 메모 (왜)

- **mock repository 단순 패턴**: RSSService 는 wrapper 만이라 integration test 불요. SQL 정합은 PostRepository.test.ts 에서 분리 검증 (있다면). 본 phase 는 service 단의 wiring 만
- **BLG15 정적 검사 자동화**: select 객체와 Pick 키 집합 mismatch 는 type-check 가 자동 잡지만, content 같은 *없어야 할* 키 회귀는 grep 으로 추가 보호 — 미래에 content 다시 추가하려는 의도치 않은 변경 사전 감지
- **build/test/lint/type-check 모두 실행**: 본 plan 은 service + repository + route 동시 변경이라 통합 검증 필수
