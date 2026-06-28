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

// Statuses where a fixture is done and its own result can't change again.
const SETTLED = new Set(["FINISHED", "AWARDED", "CANCELLED"])

// How long after kickoff a match's own score can still be settling (extra time,
// penalties, the API finalizing the result). Keeps live and just-finished matches
// refreshing.
const MATCH_ACTIVE_MS = 4 * 60 * 60 * 1000

// Whether it's worth calling the API again. Two independent triggers; otherwise the
// snapshot can't have moved and we serve it untouched (and never refetch once
// `frozen`). We scan the whole WC schedule, not just our 10 tracked matches: the
// derived fasit depends on tables, bracket progression and scorers across all of it.
// With no schedule cached yet, we always refetch.
function shouldRefetch(matches: ApiMatch[], now: number, fetchedAt: number): boolean {
  if (matches.length === 0) return true

  // (a) A match is live, or finished recently enough that its score could still be
  //     settling since we last fetched.
  const liveOrJustPlayed = matches.some((m) => {
    if (!m.utcDate) return false
    const kickoff = Date.parse(m.utcDate)
    if (Number.isNaN(kickoff) || kickoff > now) return false // not started yet
    return kickoff + MATCH_ACTIVE_MS > fetchedAt
  })
  if (liveOrJustPlayed) return true

  // (b) The next round is still being seeded: an upcoming fixture is missing a team
  //     even though every match before it has finished. The API fills in the bracket
  //     — and the tables / European-team count we derive from it — some time after
  //     the previous round ends, with no kickoff to trigger (a) and at a lag we can't
  //     predict, so we poll until it appears. Bounded to the gaps between rounds:
  //     mid-round the next round's fixtures still have un-played matches ahead of
  //     them, so this stays false and we don't poll needlessly.
  return matches.some((m) => {
    if (!m.utcDate) return false
    const kickoff = Date.parse(m.utcDate)
    if (Number.isNaN(kickoff) || kickoff <= now) return false // upcoming only
    if (m.homeTeam?.name && m.awayTeam?.name) return false // already seeded
    return matches.every((o) => {
      if (!o.utcDate) return true
      const k = Date.parse(o.utcDate)
      return Number.isNaN(k) || k >= kickoff || SETTLED.has(o.status)
    })
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
      if (!shouldRefetch(cached.matches, now, Date.parse(cached.fetchedAt))) return cached
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
