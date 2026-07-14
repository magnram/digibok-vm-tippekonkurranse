import type {
  AnswerLine,
  AnswerStatus,
  BonusBreakdown,
  Contestant,
  Fasit,
  MatchResult,
  ScoreBreakdown,
} from "./types"

function outcome(home: number, away: number): "H" | "U" | "B" {
  if (home > away) return "H"
  if (home < away) return "B"
  return "U"
}

// Point values per round, taken from the spreadsheet rules.
const POINTS = {
  groupQuestion: 2,
  norway: 2,
  knockout: 2, // Sweden / euro-count / hosts
  quarterfinalist: 2, // per correctly placed quarterfinalist (8 teams -> max 16)
  finalBothTeams: 4,
  finalOneTeam: 2,
  finalScore: 3,
  champion: 5,
  topScorerCountry: 3,
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

// Canonical form so "Ja"/"J" and "Nei"/"N" compare equal, while team/name
// answers fall back to a plain normalized string.
function canon(s: string | null | undefined): string {
  const v = norm(s)
  if (v === "j" || v === "ja") return "j"
  if (v === "n" || v === "nei") return "n"
  return v
}

// A fasit answer counts as decided once it holds a real value. Blank or "-"
// means "not known yet" and is scored as pending (neither right nor wrong).
function decided(s: string | null | undefined): boolean {
  const v = norm(s)
  return v !== "" && v !== "-"
}

function eq(a: string | null | undefined, b: string | null | undefined): boolean {
  return canon(a) === canon(b)
}

// Pretty-prints a fasit answer for display (Ja/Nei for J/N, otherwise as-is).
function label(s: string): string {
  const v = canon(s)
  if (v === "j") return "Ja"
  if (v === "n") return "Nei"
  return s
}

// Scores a plain single-answer question worth `max` points all-or-nothing.
function single(
  predicted: string | null | undefined,
  fasit: string | null | undefined,
  max: number,
): Omit<AnswerLine, "key"> {
  if (!decided(fasit)) return { points: 0, max, status: "pending", correct: null }
  const hit = eq(predicted, fasit)
  return {
    points: hit ? max : 0,
    max,
    status: hit ? "correct" : "wrong",
    correct: label(fasit!),
  }
}

// Champion: a single team pick worth 5. Once that team is knocked out — and while
// the winner is still undecided — those points are gone, so the line forfeits its max.
function champion(
  predicted: string | null | undefined,
  fasit: string | null | undefined,
  eliminated: Set<string>,
): Omit<AnswerLine, "key"> {
  const line = single(predicted, fasit, POINTS.champion)
  if (line.status !== "pending") return line
  const dead = decided(predicted) && eliminated.has(canon(predicted))
  return { ...line, forfeited: dead ? POINTS.champion : undefined }
}

// Top-scorer country: a country pick worth 3. Impossible — and so forfeited — once
// that country's team is out *and* it isn't among the countries currently leading the
// scoring chart (an eliminated team's goal tally is frozen, so a country already
// behind can never catch up). A country still tied for the lead keeps its points in
// play, since no one has pulled ahead of it yet.
function topScorerCountry(
  predicted: string | null | undefined,
  fasit: string | null | undefined,
  eliminated: Set<string>,
  leaders: Set<string>,
): Omit<AnswerLine, "key"> {
  const line = single(predicted, fasit, POINTS.topScorerCountry)
  if (line.status !== "pending") return line
  const p = canon(predicted)
  const dead = decided(predicted) && eliminated.has(p) && !leaders.has(p)
  return { ...line, forfeited: dead ? POINTS.topScorerCountry : undefined }
}

// 8 quarterfinalists, 2 points per correctly named team (order-independent).
// `eliminated` are teams already knocked out: a pick on one can no longer score, so
// it's flagged as a known miss (`dead`) and its points drop out of "still possible"
// even before the full quarterfinal lineup is known.
function quarterfinalists(predicted: string[], fasit: string[], eliminated: string[] = []): AnswerLine {
  const max = 8 * POINTS.quarterfinalist
  const knownFasit = fasit.filter(decided)
  const isDecided = knownFasit.length > 0
  const fasitSet = new Set(knownFasit.map(canon))
  const deadSet = new Set(eliminated.map(canon))

  const matched = new Set<string>()
  const chips = predicted.map((value) => {
    const c = canon(value)
    const hit = isDecided && fasitSet.has(c) && !matched.has(c)
    if (hit) matched.add(c)
    // A team can't be both a confirmed quarterfinalist and eliminated; guard anyway.
    const dead = !hit && deadSet.has(c)
    return { value, hit, dead }
  })

  const hits = chips.filter((ch) => ch.hit).length
  const deadCount = chips.filter((ch) => ch.dead).length
  let status: AnswerStatus
  if (isDecided) status = hits === 8 ? "correct" : hits > 0 ? "partial" : "wrong"
  // Not yet decided, but every pick is already knocked out: the line is lost.
  else if (predicted.length > 0 && deadCount === predicted.length) status = "wrong"
  else status = "pending"

  return {
    key: "quarterfinalists",
    points: hits * POINTS.quarterfinalist,
    max,
    status,
    correct: isDecided ? knownFasit.join(", ") : null,
    chips,
    // While still pending, points tied up in knocked-out picks are no longer winnable.
    forfeited: status === "pending" ? deadCount * POINTS.quarterfinalist : undefined,
    eliminated,
  }
}

// Final pairing: 4 points for both teams (order-independent), 2 for one. While the
// final is still undecided, each picked finalist that is already knocked out forfeits
// its 2 points — they can no longer be won.
function finalTeams(
  pred: Contestant["final"],
  fasit: Fasit["final"],
  eliminated: Set<string>,
): Omit<AnswerLine, "key"> {
  const max = POINTS.finalBothTeams
  if (!decided(fasit.team1) && !decided(fasit.team2)) {
    const deadCount = [pred.team1, pred.team2].filter(decided).map(canon).filter((p) => eliminated.has(p)).length
    const forfeited = Math.min(deadCount * POINTS.finalOneTeam, max)
    return { points: 0, max, status: "pending", correct: null, forfeited: forfeited || undefined }
  }
  const fasitSet = new Set([fasit.team1, fasit.team2].filter(decided).map(canon))
  const used = new Set<string>()
  let hits = 0
  for (const p of [pred.team1, pred.team2].filter(decided).map(canon)) {
    if (fasitSet.has(p) && !used.has(p)) {
      hits++
      used.add(p)
    }
  }
  const points = hits >= 2 ? POINTS.finalBothTeams : hits === 1 ? POINTS.finalOneTeam : 0
  const status: AnswerStatus = hits >= 2 ? "correct" : hits === 1 ? "partial" : "wrong"
  return {
    points,
    max,
    status,
    correct: `${fasit.team1 || "?"} – ${fasit.team2 || "?"}`,
  }
}

// Final scoreline after 90 min, compared order-independently (we don't know
// which way round each contestant's predicted teams line up with the real final).
function finalScore(pred: Contestant["final"], fasit: Fasit["final"]): Omit<AnswerLine, "key"> {
  const max = POINTS.finalScore
  if (fasit.score1 == null || fasit.score2 == null) {
    return { points: 0, max, status: "pending", correct: null }
  }
  const correct = `${fasit.score1}–${fasit.score2}`
  if (pred.score1 == null || pred.score2 == null) {
    return { points: 0, max, status: "wrong", correct }
  }
  const sort = (a: number, b: number) => [a, b].sort((x, y) => x - y).join("-")
  const hit = sort(pred.score1, pred.score2) === sort(fasit.score1, fasit.score2)
  return { points: hit ? max : 0, max, status: hit ? "correct" : "wrong", correct }
}

// Scores everything outside the tracked group matches against the fasit.
function scoreBonus(c: Contestant, fasit: Fasit): { bonus: BonusBreakdown; bonusPoints: number } {
  const groupQuestions: Record<string, AnswerLine> = {}
  for (const key of Object.keys(fasit.groupQuestions)) {
    groupQuestions[key] = {
      key,
      ...single(c.groupQuestions[key], fasit.groupQuestions[key], POINTS.groupQuestion),
    }
  }

  const norway: Record<string, AnswerLine> = {
    score7plus: { key: "score7plus", ...single(c.norway.score7plus, fasit.norway.score7plus, POINTS.norway) },
    concede4plus: { key: "concede4plus", ...single(c.norway.concede4plus, fasit.norway.concede4plus, POINTS.norway) },
    meetBrazil: { key: "meetBrazil", ...single(c.norway.meetBrazil, fasit.norway.meetBrazil, POINTS.norway) },
    furthest: { key: "furthest", ...single(c.norway.furthest, fasit.norway.furthest, POINTS.norway) },
    topScorer: { key: "topScorer", ...single(c.norway.topScorer, fasit.norway.topScorer, POINTS.norway) },
  }

  const knockout: Record<string, AnswerLine> = {
    swedenAdvances: {
      key: "swedenAdvances",
      ...single(c.knockout.swedenAdvances, fasit.knockout.swedenAdvances, POINTS.knockout),
    },
    europeanTeams: {
      key: "europeanTeams",
      ...single(c.knockout.europeanTeams, fasit.knockout.europeanTeams, POINTS.knockout),
    },
    hostsAdvance: {
      key: "hostsAdvance",
      ...single(c.knockout.hostsAdvance, fasit.knockout.hostsAdvance, POINTS.knockout),
    },
    quarterfinalists: quarterfinalists(
      c.knockout.quarterfinalists,
      fasit.knockout.quarterfinalists,
      fasit.knockout.eliminated ?? [],
    ),
  }

  // Teams already out of the tournament, and the countries currently leading the
  // scoring chart — used to zero out final-round points that can no longer be won.
  const eliminatedSet = new Set((fasit.knockout.eliminated ?? []).map(canon))
  const leaderSet = new Set((fasit.final.topScorerLeaders ?? []).map(canon))

  const final: Record<string, AnswerLine> = {
    teams: { key: "teams", ...finalTeams(c.final, fasit.final, eliminatedSet) },
    score: { key: "score", ...finalScore(c.final, fasit.final) },
    champion: { key: "champion", ...champion(c.final.champion, fasit.final.champion, eliminatedSet) },
    topScorerCountry: {
      key: "topScorerCountry",
      ...topScorerCountry(c.final.topScorerCountry, fasit.final.topScorerCountry, eliminatedSet, leaderSet),
    },
  }

  const bonus: BonusBreakdown = { groupQuestions, norway, knockout, final }
  const bonusPoints = [groupQuestions, norway, knockout, final]
    .flatMap((group) => Object.values(group))
    .reduce((sum, line) => sum + line.points, 0)

  return { bonus, bonusPoints }
}

// Scores a single contestant: the 10 group-match predictions plus every other
// round (group questions, Norway, knockout, final) against the fasit.
// Rules (from the spreadsheet): correct outcome (H/U/B) = 1 pt, exact score = 1 pt.
export function scoreContestant(
  c: Contestant,
  results: Record<string, MatchResult>,
  fasit: Fasit,
): ScoreBreakdown {
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
      open: !settled,
    }
  })

  const matchPoints = outcomePoints + exactPoints
  const { bonus, bonusPoints } = scoreBonus(c, fasit)
  const total = matchPoints + bonusPoints

  // Points still in play: every unplayed match is worth its full 2 points, and
  // every question whose answer key isn't decided yet can still earn its max.
  // (A settled-but-wrong match/question contributes nothing - it can't be
  // recovered - so the ceiling shrinks over time toward the locked-in total.)
  const matchRemaining = matches.filter((m) => m.open).length * 2
  const bonusRemaining = [bonus.groupQuestions, bonus.norway, bonus.knockout, bonus.final]
    .flatMap((group) => Object.values(group))
    .filter((line) => line.status === "pending")
    // A pending line can still earn its max, minus any points already forfeited on it
    // (e.g. QF picks whose teams are knocked out).
    .reduce((sum, line) => sum + line.max - (line.forfeited ?? 0), 0)
  const remainingPoints = matchRemaining + bonusRemaining

  return {
    name: c.name,
    total,
    matchPoints,
    outcomePoints,
    exactPoints,
    bonusPoints,
    maxPoints: total + remainingPoints,
    remainingPoints,
    matches,
    bonus,
  }
}

// The perfect-card total: every tracked match (2 pts) plus every bonus question
// at full marks. Constant across contestants; handy for "X av Y mulige" context.
export function perfectTotal(breakdown: ScoreBreakdown): number {
  const matchMax = breakdown.matches.length * 2
  const bonusMax = [
    breakdown.bonus.groupQuestions,
    breakdown.bonus.norway,
    breakdown.bonus.knockout,
    breakdown.bonus.final,
  ]
    .flatMap((g) => Object.values(g))
    .reduce((s, l) => s + l.max, 0)
  return matchMax + bonusMax
}

export function buildStandings(
  contestants: Contestant[],
  results: Record<string, MatchResult>,
  fasit: Fasit,
): ScoreBreakdown[] {
  return contestants
    .map((c) => scoreContestant(c, results, fasit))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "nb"))
}
