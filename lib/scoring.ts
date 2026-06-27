import type { Contestant, MatchResult, ScoreBreakdown } from "./types"

function outcome(home: number, away: number): "H" | "U" | "B" {
  if (home > away) return "H"
  if (home < away) return "B"
  return "U"
}

// Scores a single contestant's 10 group-match predictions against live results.
// Rules (from the spreadsheet): correct outcome (H/U/B) = 1 pt, exact score = 1 pt.
export function scoreContestant(c: Contestant, results: Record<string, MatchResult>): ScoreBreakdown {
  let outcomePoints = 0
  let exactPoints = 0

  const matches = c.groupMatches.map((pm) => {
    const r = results[pm.id]
    const settled = !!r && r.final && r.home != null && r.away != null
    let outcomeHit = false
    let exactHit = false
    let points = 0

    if (settled && pm.home != null && pm.away != null) {
      if (outcome(pm.home, pm.away) === outcome(r.home!, r.away!)) {
        outcomeHit = true
        outcomePoints += 1
        points += 1
      }
      if (pm.home === r.home && pm.away === r.away) {
        exactHit = true
        exactPoints += 1
        points += 1
      }
    }

    return {
      id: pm.id,
      predicted: { home: pm.home, away: pm.away },
      actual: settled ? { home: r.home!, away: r.away! } : null,
      outcomeHit,
      exactHit,
      points,
      settled,
    }
  })

  const matchPoints = outcomePoints + exactPoints
  return {
    name: c.name,
    total: matchPoints,
    matchPoints,
    outcomePoints,
    exactPoints,
    matches,
  }
}

export function buildStandings(
  contestants: Contestant[],
  results: Record<string, MatchResult>,
): ScoreBreakdown[] {
  return contestants
    .map((c) => scoreContestant(c, results))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "nb"))
}
