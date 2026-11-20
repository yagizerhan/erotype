// SPDX-License-Identifier: AGPL-3.0-or-later
// D1 (SQLite) database schema
// The first 4 tables are managed by Better Auth (column names follow library defaults).
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------- Better Auth tables ----------------
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (t) => [index("session_user_idx").on(t.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull()
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
});

// ---------------- Game tables ----------------
/** Public player profile (stores public username and aggregate counters). */
export const profile = sqliteTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(), // 3-20, [a-z0-9_]
  bio: text("bio"),
  createdAt: integer("created_at").notNull(),
  racesTotal: integer("races_total").notNull().default(0),
  racesWon: integer("races_won").notNull().default(0),
  testsTotal: integer("tests_total").notNull().default(0),
  /** Moderation flag: when 1, hidden from leaderboards and new results are not saved. */
  banned: integer("banned").notNull().default(0)
});

/** Every completed solo test or multiplayer race. id = testId (prevents ticket replay). */
export const result = sqliteTable(
  "result",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(), // 'time' | 'words' | 'quote' | 'race'
    mode2: text("mode2").notNull(), // '15', '60', '25', quote id, or race duration/mode
    lang: text("lang").notNull(),
    wpm: real("wpm").notNull(),
    rawWpm: real("raw_wpm").notNull(),
    acc: real("acc").notNull(),
    consistency: real("consistency"),
    durationMs: integer("duration_ms").notNull(),
    roomId: text("room_id"),
    place: integer("place"),
    createdAt: integer("created_at").notNull()
  },
  (t) => [index("result_user_time").on(t.userId, t.createdAt)]
);

/** Personal best per mode/variant/language (backs the leaderboard). */
export const personalBest = sqliteTable(
  "personal_best",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    mode2: text("mode2").notNull(),
    lang: text("lang").notNull(),
    wpm: real("wpm").notNull(),
    acc: real("acc").notNull(),
    resultId: text("result_id").notNull(),
    createdAt: integer("created_at").notNull()
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mode, t.mode2, t.lang] }),
    index("pb_board").on(t.mode, t.mode2, t.lang, t.wpm)
  ]
);

export const schema = { user, session, account, verification, profile, result, personalBest };
