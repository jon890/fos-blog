import { eq, and, sql, inArray, desc, asc } from "drizzle-orm";
import { visitLogs, visitStats } from "../schema";
import { BaseRepository } from "./BaseRepository";
import logger from "@/lib/logger";

const log = logger.child({ module: "infra/db/repositories/VisitRepository" });

export class VisitRepository extends BaseRepository {
  /**
   * 방문 기록 처리 (하루 1회 IP 기반 중복 방지)
   * @returns 새로운 방문이면 true, 이미 기록된 방문이면 false
   */
  async recordVisit(pagePath: string, ipHash: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

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
        return false;
      }

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
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "방문 기록 실패");
      return false;
    }
  }

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

  async getPopularPostPaths(limit: number = 6): Promise<{ path: string; visitCount: number }[]> {
    try {
      const results = await this.db
        .select({ pagePath: visitStats.pagePath, visitCount: visitStats.visitCount })
        .from(visitStats)
        .orderBy(desc(visitStats.visitCount))
        .limit(limit);
      return results.map(r => ({ path: r.pagePath, visitCount: r.visitCount }));
    } catch { return []; }
  }

  async getPopularPostPathsOffset(params: {
    limit: number;
    offset: number;
  }): Promise<Array<{ path: string; visitCount: number }>> {
    const { limit, offset } = params;
    const results = await this.db
      .select({ pagePath: visitStats.pagePath, visitCount: visitStats.visitCount })
      .from(visitStats)
      .orderBy(desc(visitStats.visitCount), asc(visitStats.pagePath))
      .limit(limit)
      .offset(offset);
    return results.map((r) => ({ path: r.pagePath, visitCount: r.visitCount }));
  }

  async getPopularPostPathsTotal(): Promise<number> {
    try {
      const result = await this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(visitStats);
      return Number(result[0]?.total ?? 0);
    } catch (error) {
      log.error(
        {
          component: "repo.visit",
          operation: "getPopularPostPathsTotal",
          err: error instanceof Error ? error : new Error(String(error)),
        },
        "failed to count popular posts"
      );
      throw error;
    }
  }

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
