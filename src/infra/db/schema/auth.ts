import {
  boolean,
  index,
  mysqlTable,
  text,
  customType,
  datetime,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// 식별자와 세션 토큰은 대소문자를 구분한다.
const binaryId = customType<{ data: string; driverData: string }>({
  dataType: () => "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin",
});
const authDate = (name: string) => datetime(name, { mode: "date", fsp: 3 });

export const authUser = mysqlTable("auth_user", {
  id: binaryId("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: authDate("created_at").notNull(),
  updatedAt: authDate("updated_at").notNull(),
});

export const authSession = mysqlTable(
  "auth_session",
  {
    id: binaryId("id").primaryKey(),
    userId: binaryId("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    token: binaryId("token").notNull().unique(),
    expiresAt: authDate("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: authDate("created_at").notNull(),
    updatedAt: authDate("updated_at").notNull(),
  },
  (table) => [index("auth_session_user_id_idx").on(table.userId)],
);

export const authAccount = mysqlTable(
  "auth_account",
  {
    id: binaryId("id").primaryKey(),
    userId: binaryId("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accountId: binaryId("account_id").notNull(),
    providerId: binaryId("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: authDate("access_token_expires_at"),
    refreshTokenExpiresAt: authDate("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: authDate("created_at").notNull(),
    updatedAt: authDate("updated_at").notNull(),
  },
  (table) => [
    index("auth_account_user_id_idx").on(table.userId),
    uniqueIndex("auth_account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const authVerification = mysqlTable(
  "auth_verification",
  {
    id: binaryId("id").primaryKey(),
    identifier: binaryId("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: authDate("expires_at").notNull(),
    createdAt: authDate("created_at").notNull(),
    updatedAt: authDate("updated_at").notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const authSchema = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
} as const;

export type AuthUser = typeof authUser.$inferSelect;
export type NewAuthUser = typeof authUser.$inferInsert;
export type AuthSession = typeof authSession.$inferSelect;
export type NewAuthSession = typeof authSession.$inferInsert;
export type AuthAccount = typeof authAccount.$inferSelect;
export type NewAuthAccount = typeof authAccount.$inferInsert;
export type AuthVerification = typeof authVerification.$inferSelect;
export type NewAuthVerification = typeof authVerification.$inferInsert;
