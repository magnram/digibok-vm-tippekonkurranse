export type Match = {
  id: string
  group: string
  date: string // dd.mm.yyyy
  time: string // HH:MM
  home: string // Norwegian team name
  away: string
}

export type GroupQuestion = {
  row: number
  key: string
  text: string
}

export type Contestant = {
  name: string
  groupMatches: { id: string; home: number | null; away: number | null }[]
  groupQuestions: Record<string, string>
  norway: {
    score7plus: string
    concede4plus: string
    meetBrazil: string
    furthest: string
    topScorer: string
  }
  knockout: {
    swedenAdvances: string
    europeanTeams: string
    hostsAdvance: string
    quarterfinalists: string[]
  }
  final: {
    team1: string
    team2: string
    score1: number | null
    score2: number | null
    champion: string
    topScorerCountry: string
  }
}

export type PredictionData = {
  matches: Match[]
  groupQuestions: GroupQuestion[]
  contestants: Contestant[]
}

// The answer key (fasit) for everything that isn't a tracked group-match score.
// Mirrors the non-match shape of a Contestant. Each field is left blank/null
// until the real-world answer is known; scoring only awards points for decided
// fields, so the organizer fills these in as the tournament unfolds.
export type Fasit = {
  groupQuestions: Record<string, string>
  norway: {
    score7plus: string
    concede4plus: string
    meetBrazil: string
    furthest: string
    topScorer: string
  }
  knockout: {
    swedenAdvances: string
    europeanTeams: string
    hostsAdvance: string
    quarterfinalists: string[]
    // Teams that can no longer reach the quarterfinals (lost a knockout tie, or are
    // out of the group stage). Used to mark QF picks as known-wrong before the full
    // quarterfinal lineup is settled. Derived only; not manually entered.
    eliminated?: string[]
  }
  final: {
    team1: string
    team2: string
    score1: number | null
    score2: number | null
    champion: string
    topScorerCountry: string
  }
}

export type MatchStatus =
  | "FINISHED"
  | "AWARDED"
  | "IN_PLAY"
  | "PAUSED"
  | "TIMED"
  | "SCHEDULED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"

// Display phase for a fixture, derived from its result and scheduled kickoff.
//  - upcoming: hasn't kicked off yet
//  - live:     currently being played
//  - awaiting: should have been played by now, but no final result fetched yet
//  - finished: final result is in
export type MatchPhase = "upcoming" | "live" | "awaiting" | "finished"

// An actual result for one of the tracked group matches.
export type MatchResult = {
  id: string
  home: number | null // full-time score, null until known
  away: number | null
  status: MatchStatus
  utcDate?: string
  final: boolean // computed: the score above is the final score (safe to award points)
}

export type ResultsPayload = {
  results: Record<string, MatchResult> // keyed by match id (m1..m10)
  source: "api" | "none"
  fetchedAt: string
  note?: string
}

// One scored answer outside the group matches.
//  - pending:  the fasit answer isn't decided yet (no points lost or gained)
//  - correct:  full points
//  - partial:  some but not all points (e.g. one final team, some QF teams)
//  - wrong:    decided and missed
export type AnswerStatus = "pending" | "correct" | "partial" | "wrong"

export type AnswerLine = {
  key: string
  points: number // points awarded
  max: number // maximum possible
  status: AnswerStatus
  correct: string | null // the fasit answer for display, null while pending
  // per-item correctness (quarterfinalists). `dead` = the pick is already
  // impossible because that team is knocked out, even if the line is still pending.
  chips?: { value: string; hit: boolean; dead?: boolean }[]
  // Of a still-pending line's `max`, how many points are already forfeited (e.g. QF
  // picks on knocked-out teams). Subtracted from "still possible" so the ceiling is honest.
  forfeited?: number
  // Teams known to be knocked out, for marking QF picks as wrong early (quarterfinalists only).
  eliminated?: string[]
}

// All non-match rounds, keyed by field so the UI can look up each line.
export type BonusBreakdown = {
  groupQuestions: Record<string, AnswerLine>
  norway: Record<string, AnswerLine>
  knockout: Record<string, AnswerLine>
  final: Record<string, AnswerLine>
}

// Per-contestant computed score breakdown.
export type ScoreBreakdown = {
  name: string
  total: number // matchPoints + bonusPoints - points already locked in
  matchPoints: number
  outcomePoints: number
  exactPoints: number
  bonusPoints: number // points from group questions, Norway, knockout and final
  // The most this contestant can still reach: locked-in points plus everything
  // still undecided (unplayed matches + pending questions). Shrinks as answers
  // are settled wrong. `remainingPoints` is the still-in-play part (maxPoints - total).
  maxPoints: number
  remainingPoints: number
  matches: {
    id: string
    predicted: { home: number | null; away: number | null }
    actual: { home: number; away: number } | null
    outcomeHit: boolean
    exactHit: boolean
    points: number
    settled: boolean
    open: boolean // not settled yet - its 2 points are still up for grabs
  }[]
  bonus: BonusBreakdown
}

// The maximum points obtainable in the whole contest (a perfect card).
export const MATCH_POINTS_EACH = 2
