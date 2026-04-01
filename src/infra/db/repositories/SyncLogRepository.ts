import { desc, eq } from "drizzle-orm";
import { syncLogs } from "../schema";
import { CreateSyncLog } from "../schema/syncLogs";
import { BaseRepository } from "./BaseRepository";

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
