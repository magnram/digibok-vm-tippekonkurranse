import "server-only"
import predictions from "./data/predictions.json"
import { norwegianFromEnglish } from "./teams"
import { isFinalResult } from "./match-time"
import { getWcData } from "./wc-api"
import type { ApiMatch } from "./fasit-derive"
import type { MatchResult, MatchStatus, ResultsPayload, PredictionData } from "./types"

const DATA = predictions as PredictionData

// Returns the contest's match results, mapped from the shared WC snapshot
// (lib/wc-api.ts). That snapshot is the single Postgres-cached source of truth, so
// this does no network or DB work of its own — the API is touched at most once per
// refresh window across the whole page, and never once the tournament is frozen.
export async function getResults(): Promise<ResultsPayload> {
  const now = Date.now()
  const data = await getWcData()

  if (!data) {
    const note = process.env.FOOTBALL_DATA_API_KEY
      ? "Kunne ikke hente resultater fra football-data.org akkurat nå."
      : "Mangler FOOTBALL_DATA_API_KEY – legg den til for å hente live resultater."
    return { results: {}, source: "none", fetchedAt: new Date(now).toISOString(), note }
  }

  const results = mapMatches(data.matches, now)
  const note =
    Object.keys(results).length === 0
      ? "Ingen av kampene i konkurransen er tilgjengelige i API-et ennå."
      : undefined
  return { results, source: "api", fetchedAt: data.fetchedAt, note }
}

// Maps the WC feed onto the 10 tracked fixtures.
function mapMatches(apiMatches: ApiMatch[], now: number): Record<string, MatchResult> {
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
