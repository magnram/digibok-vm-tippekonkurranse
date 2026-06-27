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

// An actual result for one of the tracked group matches.
export type MatchResult = {
  id: string
  home: number
  away: number
  status: "FINISHED" | "IN_PLAY" | "PAUSED" | "TIMED" | "SCHEDULED"
  utcDate?: string
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
