import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { SyncLog, syncLogs, visitLogs, visitStats } from "../schema";
import { BaseRepository } from "./BaseRepository";
import { CreateSyncLog } from "../schema/syncLogs";

export class SyncLogRepository extends BaseRepository {
  async getLatest() {
    const result = await this.db
      .select({ commitSha: syncLogs.commitSha })
      .from(syncLogs)
      .where(eq(syncLogs.status, "success"))
      .orderBy(desc(syncLogs.syncedAt))
      .limit(1);

    if (result.length == 0) {
      return null;
    }

    return result[0];
  }

  async create(syncLog: CreateSyncLog) {
    return this.db.insert(syncLogs).values(syncLog);
  }
}
