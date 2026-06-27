import "server-only"
import { cache } from "react"
import { eq } from "drizzle-orm"
import { getDb, warnDbUnavailable } from "./db"
import { apiCache } from "./db/schema"
import type { ApiMatch, ApiScorer, ApiStanding } from "./fasit-derive"

// Re-fetch at most once per window while the tournament is live.
const TTL_MS = 5 * 60 * 1000
const ID = "wc"
const BASE = "https://api.football-data.org/v4/competitions/WC"

export type WcData = {
  matches: ApiMatch[]
  standings: ApiStanding[]
  scorers: ApiScorer[]
  fetchedAt: string
  frozen: boolean
}

// The whole dataset becomes immutable once the final has been played.
function isFrozen(matches: ApiMatch[]): boolean {
  const final = matches.find((m) => m.stage === "FINAL")
  return !!final && final.status === "FINISHED"
}

// Statuses where a fixture is done and its data can't change again.
const SETTLED = new Set(["FINISHED", "AWARDED", "CANCELLED"])

// Whether it's worth calling the API again. Only when a fixture has kicked off
// since the snapshot was taken — some match is live, or has finished but isn't yet
// recorded as settled in our snapshot. When nothing new has started since the last
// fetch, every result, table and scorer is already cached, so we keep serving it
// rather than re-downloading data that can't have moved. (We scan the whole WC
// schedule, not just our 10 tracked matches: the derived fasit depends on group
// tables, knockout progression and scorers across all of it.) With no schedule
// cached yet, we always refetch.
function shouldRefetch(matches: ApiMatch[], now: number): boolean {
  if (matches.length === 0) return true
  return matches.some((m) => {
    if (SETTLED.has(m.status) || !m.utcDate) return false
    return Date.parse(m.utcDate) <= now
  })
}

// The single gateway to football-data.org. Memoized per request (React cache) so
// every consumer in one render shares one result, and persisted in Postgres so the
// API is only called when the stored snapshot is stale *and* a fixture has actually
// kicked off since it was taken — never for data that can't have changed, and never
// again once the snapshot is frozen. Degrades to a direct fetch if the DB is
// unavailable, and to the last good snapshot if the API call fails.
export const getWcData = cache(async (): Promise<WcData | null> => {
  const now = Date.now()
  try {
    const cached = await loadFromDb()
    if (cached) {
      if (cached.frozen) return cached
      if (now - Date.parse(cached.fetchedAt) < TTL_MS) return cached
      // Past the refresh window — but skip the API entirely unless a fixture has
      // kicked off since this snapshot. Finished results can't change, so when
      // nothing new has started we keep serving the cache.
      if (!shouldRefetch(cached.matches, now)) return cached
    }
    const fresh = await fetchAll(now)
    if (fresh) {
      await store(fresh)
      return fresh
    }
    return cached // API failed: serve the last good snapshot if we have one.
  } catch (err) {
    warnDbUnavailable("wc-api", err)
    return fetchAll(now) // DB down: fetch directly (uncached) so the app still works.
  }
})

// --- Postgres cache -------------------------------------------------------

async function loadFromDb(): Promise<WcData | null> {
  const db = getDb()
  const [row] = await db.select().from(apiCache).where(eq(apiCache.id, ID))
  if (!row) return null
  const parsed = JSON.parse(row.payload) as Pick<WcData, "matches" | "standings" | "scorers">
  return { ...parsed, fetchedAt: row.fetchedAt.toISOString(), frozen: row.frozen }
}

async function store(data: WcData): Promise<void> {
  const db = getDb()
  const values = {
    id: ID,
    payload: JSON.stringify({ matches: data.matches, standings: data.standings, scorers: data.scorers }),
    frozen: data.frozen,
    fetchedAt: new Date(data.fetchedAt),
  }
  await db
    .insert(apiCache)
    .values(values)
    .onConflictDoUpdate({
      target: apiCache.id,
      set: { payload: values.payload, frozen: values.frozen, fetchedAt: values.fetchedAt },
    })
}

// --- football-data.org ----------------------------------------------------

async function fetchAll(now: number): Promise<WcData | null> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return null

  // Our Postgres snapshot is the cache, so opt out of Next's fetch cache here.
  const opts = { headers: { "X-Auth-Token": apiKey }, cache: "no-store" as const }
  try {
    const [mRes, sRes, scRes] = await Promise.all([
      fetch(`${BASE}/matches`, opts),
      fetch(`${BASE}/standings`, opts),
      fetch(`${BASE}/scorers?limit=100`, opts),
    ])

    // Matches + standings are required; scorers (top-scorer fields) are optional.
    if (!mRes.ok || !sRes.ok) return null

    const matches = ((await mRes.json()).matches ?? []) as ApiMatch[]
    const standings = ((await sRes.json()).standings ?? []) as ApiStanding[]
    const scorers = (scRes.ok ? ((await scRes.json()).scorers ?? []) : []) as ApiScorer[]

    return { matches, standings, scorers, fetchedAt: new Date(now).toISOString(), frozen: isFrozen(matches) }
  } catch {
    return null
  }
}
