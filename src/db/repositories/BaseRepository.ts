import { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../schema";

export type DbInstance = MySql2Database<typeof schema>;

export abstract class BaseRepository {
  constructor(protected db: DbInstance) {}
}
