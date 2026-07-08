import "server-only"
import { MATCH_DURATION_MS } from "./match-time"
import { norwegianFromEnglish } from "./teams"
import { getWcData } from "./wc-api"
import type { ApiMatch } from "./fasit-derive"
import type { DecisionTimes } from "./history"

// We read the whole WC schedule (not just the 10 tracked fixtures) so each bet can
// be timestamped with the completion of the match that actually decided it. The
// schedule comes from the shared, Postgres-cached snapshot (no API call here).
const FINISHED = new Set(["FINISHED", "AWARDED"])

const toNo = (en?: string | null): string => (en ? (norwegianFromEnglish(en) ?? en) : "")
const letterOf = (g?: string | null): string => {
  const m = (g ?? "").match(/([A-L])\s*$/i)
  return m ? m[1].toUpperCase() : ""
}

// When a match was completed, derived from its real kickoff plus a typical match
// length. We deliberately do NOT use the feed's `lastUpdated`: that is the provider's
// database write time (often a bulk edit days later), not when the match was played.
function completionOf(m: ApiMatch): number | null {
  if (!m.status || !FINISHED.has(m.status)) return null
  if (!m.utcDate) return null
  const t = Date.parse(m.utcDate)
  return Number.isNaN(t) ? null : t + MATCH_DURATION_MS
}

export function computeDecisionTimes(matches: ApiMatch[]): DecisionTimes {
  const groupLast: Record<string, number> = {}
  const stageEnd: Record<string, number> = {}
  const teamLast: Record<string, number> = {}
  const last16WinAt: Record<string, number> = {}
  let groupStageEnd: number | null = null
  let norwayBrazil: number | null = null
  let norwayGroupLetter = ""

  const bump = (obj: Record<string, number>, key: string, v: number) => {
    if (!key) return
    obj[key] = Math.max(obj[key] ?? 0, v)
  }

  for (const m of matches) {
    const h = toNo(m.homeTeam?.name)
    const a = toNo(m.awayTeam?.name)

    if (m.stage === "GROUP_STAGE" && (h === "Norge" || a === "Norge")) {
      norwayGroupLetter = letterOf(m.group)
    }
    // A Norway–Brazil knockout tie settles the "møter Norge Brasil" bet the moment
    // it is fixtured; use its completion if played, else its kickoff.
    if (m.stage && m.stage !== "GROUP_STAGE") {
      const pair = [h, a]
      if (pair.includes("Norge") && pair.includes("Brasil")) {
        const t = completionOf(m) ?? (m.utcDate ? Date.parse(m.utcDate) : NaN)
        if (!Number.isNaN(t)) norwayBrazil = norwayBrazil == null ? t : Math.min(norwayBrazil, t)
      }
    }

    const c = completionOf(m)
    if (c == null) continue

    if (m.stage === "GROUP_STAGE") {
      bump(groupLast, letterOf(m.group), c)
      groupStageEnd = Math.max(groupStageEnd ?? 0, c)
    } else if (m.stage) {
      bump(stageEnd, m.stage, c)
    }
    // A team qualified for the quarterfinals the moment it won its round-of-16 tie —
    // each at a different time — so credit those picks individually, not all at once
    // when the last round-of-16 match ends.
    if (m.stage === "LAST_16") {
      const winner = m.score?.winner === "HOME_TEAM" ? h : m.score?.winner === "AWAY_TEAM" ? a : ""
      if (winner) last16WinAt[winner] = c
    }
    bump(teamLast, h, c)
    bump(teamLast, a, c)
  }

  const norwayGroupEnd = norwayGroupLetter ? (groupLast[norwayGroupLetter] ?? null) : null
  return { groupLast, groupStageEnd, stageEnd, norwayGroupEnd, teamLast, norwayBrazil, last16WinAt }
}

// Decision timestamps for the history graph, derived from the shared snapshot.
// Returns null when the snapshot is unavailable (the graph then falls back to fixed
// stage milestones).
export async function getDecisionTimes(): Promise<DecisionTimes | null> {
  const data = await getWcData()
  if (!data) return null
  return computeDecisionTimes(data.matches)
}
