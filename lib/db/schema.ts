import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core"

// One row per tracked group-stage fixture (m1..m10). We store the raw score and
// status from football-data.org; whether a match counts as "final" is derived at
// read time from the kickoff and current time (see lib/match-time.ts), so it is
// intentionally NOT persisted here.
export const matchResults = pgTable("match_results", {
  id: text("id").primaryKey(), // fixture id, e.g. "m1"
  home: integer("home"), // full-time score, null until known
  away: integer("away"),
  status: text("status").notNull(), // football-data.org status (FINISHED, IN_PLAY, ...)
  utcDate: timestamp("utc_date", { withTimezone: true }), // authoritative kickoff
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

// Single-row bookkeeping table tracking the last successful API sync. Drives the
// staleness check (TTL) and feeds the "Oppdatert" timestamp / status note.
export const syncState = pgTable("sync_state", {
  id: text("id").primaryKey(), // always "results"
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  source: text("source").notNull(), // "api" | "none"
  note: text("note"),
})

export type MatchResultRow = typeof matchResults.$inferSelect
export type SyncStateRow = typeof syncState.$inferSelect
