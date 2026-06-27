import "server-only"
import { eq } from "drizzle-orm"
import predictions from "./data/predictions.json"
import { norwegianFromEnglish } from "./teams"
import { isFinalResult } from "./match-time"
import { getDb } from "./db"
import { matchResults, syncState } from "./db/schema"
import type { MatchResult, MatchStatus, ResultsPayload, PredictionData } from "./types"

const DATA = predictions as PredictionData

// How long a cached result set is considered fresh before we re-fetch from the
// API. Keeps the football-data.org call to at most once per window, no matter how
// many page views happen in between.
const TTL_MS = 5 * 60 * 1000
const SYNC_ID = "results"
const API_URL = "https://api.football-data.org/v4/competitions/WC/matches"

// A finished match's result never changes, so once the feed reports a terminal
// status for every tracked fixture there is nothing left to poll for. We only
// trust the feed's own terminal status here (not the kickoff-time heuristic used
// for `final`), so a stuck/partial score is never frozen permanently.
const TERMINAL_STATUSES = new Set(["FINISHED", "AWARDED"])

function allMatchesSettled(results: Record<string, MatchResult>): boolean {
  return DATA.matches.every((m) => {
    const r = results[m.id]
    return !!r && TERMINAL_STATUSES.has(r.status)
  })
}

// Returns the contest's match results. Reads from Postgres and only hits the
// football-data.org API when there is still something that can change AND the
// cached data is stale (older than TTL_MS). Once every match is finished the
// cache is served permanently. Falls back to stale cache (or a direct API call if
// the DB is unavailable) so the page still renders if something is down.
export async function getResults(): Promise<ResultsPayload> {
  const now = Date.now()

  try {
    const cached = await loadFromDb(now)
    if (cached) {
      // Everything finished -> nothing will ever change, serve forever.
      if (allMatchesSettled(cached.results)) return cached
      // Otherwise re-fetch at most once per TTL window.
      if (now - Date.parse(cached.fetchedAt) < TTL_MS) return cached
    }

    const outcome = await fetchFromApi(now)
    if (outcome.ok) {
      await storeResults(outcome.results, outcome.note, now)
      return {
        results: outcome.results,
        source: "api",
        fetchedAt: new Date(now).toISOString(),
        note: outcome.note,
      }
    }

    // Refresh failed — serve whatever we have cached rather than nothing.
    if (cached) {
      return {
        ...cached,
        note: "Viser lagrede resultater – kunne ikke oppdatere fra API akkurat nå.",
      }
    }
    return { results: {}, source: "none", fetchedAt: new Date(now).toISOString(), note: outcome.note }
  } catch (err) {
    // Database unreachable: degrade gracefully to a direct (uncached) API call so
    // the app keeps working without Postgres configured.
    console.error("[results] database unavailable, falling back to direct API fetch:", err)
    const outcome = await fetchFromApi(now)
    if (outcome.ok) {
      return {
        results: outcome.results,
        source: "api",
        fetchedAt: new Date(now).toISOString(),
        note: outcome.note,
      }
    }
    return { results: {}, source: "none", fetchedAt: new Date(now).toISOString(), note: outcome.note }
  }
}

// --- Postgres cache -------------------------------------------------------

async function loadFromDb(now: number): Promise<ResultsPayload | null> {
  const db = getDb()
  const [state] = await db.select().from(syncState).where(eq(syncState.id, SYNC_ID))
  if (!state) return null

  const rows = await db.select().from(matchResults)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const results: Record<string, MatchResult> = {}

  for (const m of DATA.matches) {
    const row = byId.get(m.id)
    if (!row) continue
    const r: MatchResult = {
      id: row.id,
      home: row.home,
      away: row.away,
      status: row.status as MatchStatus,
      utcDate: row.utcDate ? row.utcDate.toISOString() : undefined,
      final: false,
    }
    // Derive "final" against the current time so a match settles even if the
    // cache hasn't been refreshed since its kickoff passed.
    r.final = isFinalResult(m, r, now)
    results[m.id] = r
  }

  return {
    results,
    source: state.source === "api" ? "api" : "none",
    fetchedAt: state.fetchedAt.toISOString(),
    note: state.note ?? undefined,
  }
}

async function storeResults(
  results: Record<string, MatchResult>,
  note: string | undefined,
  now: number,
): Promise<void> {
  const fetchedAt = new Date(now)
  const db = getDb()
  await db.transaction(async (tx) => {
    for (const m of DATA.matches) {
      const r = results[m.id]
      if (!r) continue
      const values = {
        id: r.id,
        home: r.home,
        away: r.away,
        status: r.status,
        utcDate: r.utcDate ? new Date(r.utcDate) : null,
        updatedAt: fetchedAt,
      }
      await tx
        .insert(matchResults)
        .values(values)
        .onConflictDoUpdate({
          target: matchResults.id,
          set: {
            home: values.home,
            away: values.away,
            status: values.status,
            utcDate: values.utcDate,
            updatedAt: values.updatedAt,
          },
        })
    }

    await tx
      .insert(syncState)
      .values({ id: SYNC_ID, fetchedAt, source: "api", note: note ?? null })
      .onConflictDoUpdate({
        target: syncState.id,
        set: { fetchedAt, source: "api", note: note ?? null },
      })
  })
}

// --- football-data.org ----------------------------------------------------

type ApiOutcome =
  | { ok: true; results: Record<string, MatchResult>; note?: string }
  | { ok: false; note: string }

async function fetchFromApi(now: number): Promise<ApiOutcome> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return { ok: false, note: "Mangler FOOTBALL_DATA_API_KEY – legg den til for å hente live resultater." }
  }

  try {
    const res = await fetch(API_URL, {
      headers: { "X-Auth-Token": apiKey },
      cache: "no-store", // our Postgres TTL governs freshness, not the Next fetch cache
    })

    if (!res.ok) {
      return { ok: false, note: `Kunne ikke hente fra football-data.org (status ${res.status}).` }
    }

    const json = (await res.json()) as {
      matches?: {
        homeTeam?: { name?: string }
        awayTeam?: { name?: string }
        score?: { fullTime?: { home?: number | null; away?: number | null } }
        status?: string
        utcDate?: string
      }[]
    }

    const results = mapMatches(json.matches ?? [], now)
    const note =
      Object.keys(results).length === 0
        ? "Ingen av kampene i konkurransen er tilgjengelige i API-et ennå."
        : undefined
    return { ok: true, results, note }
  } catch (err) {
    return { ok: false, note: `Feil ved henting av resultater: ${err instanceof Error ? err.message : "ukjent"}.` }
  }
}

// Maps the API feed onto the 10 tracked fixtures.
function mapMatches(
  apiMatches: {
    homeTeam?: { name?: string }
    awayTeam?: { name?: string }
    score?: { fullTime?: { home?: number | null; away?: number | null } }
    status?: string
    utcDate?: string
  }[],
  now: number,
): Record<string, MatchResult> {
  const results: Record<string, MatchResult> = {}

  for (const m of DATA.matches) {
    const hit = apiMatches.find((am) => {
      const h = am.homeTeam?.name ? norwegianFromEnglish(am.homeTeam.name) : null
      const a = am.awayTeam?.name ? norwegianFromEnglish(am.awayTeam.name) : null
      if (!h || !a) return false
      return (h === m.home && a === m.away) || (h === m.away && a === m.home)
    })

    if (!hit) continue

    const ft = hit.score?.fullTime
    const hasScore = ft?.home != null && ft?.away != null

    // Orient the score to our fixture's home/away.
    const apiHomeNo = hit.homeTeam?.name ? norwegianFromEnglish(hit.homeTeam.name) : null
    const sameOrientation = apiHomeNo === m.home

    const result: MatchResult = {
      id: m.id,
      home: hasScore ? (sameOrientation ? ft!.home! : ft!.away!) : null,
      away: hasScore ? (sameOrientation ? ft!.away! : ft!.home!) : null,
      status: (hit.status as MatchStatus) ?? "SCHEDULED",
      utcDate: hit.utcDate,
      final: false,
    }
    result.final = isFinalResult(m, result, now)
    results[m.id] = result
  }

  return results
}
