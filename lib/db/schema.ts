import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core"

// Single-row cache of the raw football-data.org responses for the WC competition
// (matches + standings + scorers), stored verbatim as JSON. Everything the app
// shows — match results, the answer key, and the history-graph timing — is derived
// from this snapshot in memory, so we call the API at most once per refresh window,
// shared across all consumers. Once the final is played the snapshot is `frozen`
// and served from Postgres forever: no further API calls, no rate-limit risk.
export const apiCache = pgTable("api_cache", {
  id: text("id").primaryKey(), // always "wc"
  payload: text("payload").notNull(), // JSON: { matches, standings, scorers }
  frozen: boolean("frozen").notNull().default(false),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
})

export type ApiCacheRow = typeof apiCache.$inferSelect
