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

// Per-contestant computed score breakdown.
export type ScoreBreakdown = {
  name: string
  total: number
  matchPoints: number
  outcomePoints: number
  exactPoints: number
  matches: {
    id: string
    predicted: { home: number | null; away: number | null }
    actual: { home: number; away: number } | null
    outcomeHit: boolean
    exactHit: boolean
    points: number
    settled: boolean
  }[]
}
