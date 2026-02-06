import { eq, and, sql, inArray } from "drizzle-orm";
import { visitLogs, visitStats } from "../schema";
import { BaseRepository } from "./BaseRepository";

export class VisitRepository extends BaseRepository {
  /**
   * 방문 기록 처리 (하루 1회 IP 기반 중복 방지)
   * @returns 새로운 방문이면 true, 이미 기록된 방문이면 false
   */
  async recordVisit(pagePath: string, ipHash: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // 오늘 같은 IP로 같은 페이지를 방문한 기록이 있는지 확인
      const existing = await this.db
        .select({ id: visitLogs.id })
        .from(visitLogs)
        .where(
          and(
            eq(visitLogs.pagePath, pagePath),
            eq(visitLogs.ipHash, ipHash),
            eq(visitLogs.visitedDate, today)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return false; // 이미 카운팅됨
      }

      // 방문 로그 삽입
      await this.db.insert(visitLogs).values({
        pagePath,
        ipHash,
        visitedDate: today,
      });

      // 집계 테이블 UPSERT (있으면 +1, 없으면 새로 생성)
      await this.db
        .insert(visitStats)
        .values({
          pagePath,
          visitCount: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            visitCount: sql`${visitStats.visitCount} + 1`,
          },
        });

      return true;
    } catch (error) {
      console.error("방문 기록 실패:", error);
      return false;
    }
  }

  /**
   * 특정 페이지의 조회수 반환
   */
  async getVisitCount(pagePath: string): Promise<number> {
    try {
      const result = await this.db
        .select({ visitCount: visitStats.visitCount })
        .from(visitStats)
        .where(eq(visitStats.pagePath, pagePath))
        .limit(1);

      return result[0]?.visitCount ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 사이트 전체 방문자 수 (모든 페이지의 합계)
   */
  async getTotalVisitCount(): Promise<number> {
    try {
      const result = await this.db
        .select({
          total: sql<number>`COALESCE(SUM(${visitStats.visitCount}), 0)`,
        })
        .from(visitStats);

      return result[0]?.total ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * 여러 포스트의 조회수를 일괄 조회
   */
  async getPostVisitCounts(
    pagePaths: string[]
  ): Promise<Record<string, number>> {
    if (pagePaths.length === 0) return {};

    try {
      const results = await this.db
        .select({
          pagePath: visitStats.pagePath,
          visitCount: visitStats.visitCount,
        })
        .from(visitStats)
        .where(inArray(visitStats.pagePath, pagePaths));

      const counts: Record<string, number> = {};
      for (const row of results) {
        counts[row.pagePath] = row.visitCount;
      }
      return counts;
    } catch {
      return {};
    }
  }

  /**
   * 오늘 방문자 수 (유니크 IP 기준)
   */
  async getTodayVisitorCount(): Promise<number> {
    try {
      const today = new Date().toISOString().split("T")[0];

      const result = await this.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${visitLogs.ipHash})`,
        })
        .from(visitLogs)
        .where(eq(visitLogs.visitedDate, today));

      return result[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }
}
