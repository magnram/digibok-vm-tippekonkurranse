import "server-only"
import predictions from "./data/predictions.json"
import { norwegianFromEnglish } from "./teams"
import type { MatchResult, ResultsPayload, PredictionData } from "./types"

const DATA = predictions as PredictionData

// Fetches live World Cup match results from football-data.org and maps them
// onto the 10 group-stage matches tracked in the contest.
// Auto-revalidates every 5 minutes so standings stay fresh without a redeploy.
export async function getResults(): Promise<ResultsPayload> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  const fetchedAt = new Date().toISOString()

  if (!apiKey) {
    return {
      results: {},
      source: "none",
      fetchedAt,
      note: "Mangler FOOTBALL_DATA_API_KEY – legg den til for å hente live resultater.",
    }
  }

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": apiKey },
      next: { revalidate: 300, tags: ["results"] },
    })

    if (!res.ok) {
      return {
        results: {},
        source: "none",
        fetchedAt,
        note: `Kunne ikke hente fra football-data.org (status ${res.status}).`,
      }
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

    const apiMatches = json.matches ?? []
    const results: Record<string, MatchResult> = {}

    for (const m of DATA.matches) {
      // Find an API match whose teams map to this fixture's two teams (either order).
      const hit = apiMatches.find((am) => {
        const h = am.homeTeam?.name ? norwegianFromEnglish(am.homeTeam.name) : null
        const a = am.awayTeam?.name ? norwegianFromEnglish(am.awayTeam.name) : null
        if (!h || !a) return false
        return (h === m.home && a === m.away) || (h === m.away && a === m.home)
      })

      if (!hit) continue
      const ft = hit.score?.fullTime
      if (ft?.home == null || ft?.away == null) {
        // Match exists but not played yet — record status only.
        if (hit.status && hit.status !== "FINISHED") {
          results[m.id] = {
            id: m.id,
            home: 0,
            away: 0,
            status: hit.status as MatchResult["status"],
            utcDate: hit.utcDate,
          }
        }
        continue
      }

      // Orient the score to our fixture's home/away.
      const apiHomeNo = hit.homeTeam?.name ? norwegianFromEnglish(hit.homeTeam.name) : null
      const sameOrientation = apiHomeNo === m.home
      results[m.id] = {
        id: m.id,
        home: sameOrientation ? ft.home : ft.away,
        away: sameOrientation ? ft.away : ft.home,
        status: (hit.status as MatchResult["status"]) ?? "FINISHED",
        utcDate: hit.utcDate,
      }
    }

    return {
      results,
      source: "api",
      fetchedAt,
      note:
        Object.keys(results).length === 0
          ? "Ingen av kampene i konkurransen er tilgjengelige i API-et ennå."
          : undefined,
    }
  } catch (err) {
    return {
      results: {},
      source: "none",
      fetchedAt,
      note: `Feil ved henting av resultater: ${err instanceof Error ? err.message : "ukjent"}.`,
    }
  }
}
