import { MATCH_DURATION_MS } from "./match-time"
import { EUROPEAN_TEAMS, norwegianFromEnglish } from "./teams"
import type { Fasit } from "./types"

// Raw shapes we read from football-data.org. Only the fields we use are typed.
export type ApiMatch = {
  stage: string
  group: string | null
  status: string
  utcDate?: string
  homeTeam: { name: string | null } | null
  awayTeam: { name: string | null } | null
  score: {
    winner: string | null
    duration?: string
    fullTime: { home: number | null; away: number | null }
  } | null
}

export type ApiStanding = {
  group: string | null
  type: string
  table: {
    position: number
    team: { name: string }
    points: number
    goalsFor: number
    goalsAgainst: number
  }[]
}

export type ApiScorer = {
  player: { name: string }
  team: { name: string }
  goals: number
}

export type FasitInput = {
  matches: ApiMatch[]
  standings: ApiStanding[]
  scorers: ApiScorer[]
}

const HOSTS = ["Mexico", "USA", "Canada"]

// How deep into the tournament each stage is. THIRD_PLACE counts as semifinal
// level (those teams lost the semi); the FINAL is the deepest round reached.
const STAGE_RANK: Record<string, number> = {
  GROUP_STAGE: 0,
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 4,
  THIRD_PLACE: 4,
  FINAL: 5,
}

// Eight of the twelve third-placed teams advance to the round of 32.
const BEST_THIRDS = 8

// Feed statuses where a fixture is done and its own result can't change again.
const TERMINAL_STATUSES = new Set(["FINISHED", "AWARDED", "CANCELLED"])

// Whether a fixture's own result is locked in. Trusts a terminal feed status, but
// also treats a match whose kickoff is far enough in the past as done:
// football-data sometimes leaves a played match stuck on a live/scheduled status
// (the `status` field lags behind reality), and that must never wedge either the
// next-round refetch poll (lib/wc-api.ts) or answer resolution here.
export function matchSettled(m: ApiMatch, now: number): boolean {
  if (TERMINAL_STATUSES.has(m.status)) return true
  if (!m.utcDate) return false
  const ko = Date.parse(m.utcDate)
  return !Number.isNaN(ko) && now - ko > MATCH_DURATION_MS
}

export type ThirdRecord = { letter: string; finished: boolean; pts: number; gd: number; gf: number }

// Whether the third-placed team of group `letter` has clinched ("in") or been
// eliminated ("out") from the best-third places — or is still undetermined
// ("unknown") — given every group's current third-placed record. Resolves as early
// as it is mathematically certain: a finished group's third is fixed, while an
// unfinished group's third can still end up anywhere, so it counts against us when
// checking whether we're safe, but never counts as guaranteed-ahead when checking
// whether we're out. Comparison follows FIFA's primary order: points, then goal
// difference, then goals scored.
export function bestThirdOutcome(
  rows: ThirdRecord[],
  letter: string,
  advancing = BEST_THIRDS,
): "in" | "out" | "unknown" {
  const me = rows.find((r) => r.letter === letter)
  if (!me) return "unknown"
  const others = rows.filter((r) => r.letter !== letter)

  const strictlyAhead = (a: ThirdRecord, b: ThirdRecord) =>
    a.pts !== b.pts ? a.pts > b.pts : a.gd !== b.gd ? a.gd > b.gd : a.gf > b.gf
  const maybeAhead = (a: ThirdRecord, b: ThirdRecord) =>
    a.pts !== b.pts ? a.pts > b.pts : a.gd !== b.gd ? a.gd > b.gd : a.gf >= b.gf

  // Out if at least `advancing` thirds are already guaranteed ahead of us.
  const guaranteedAhead = others.filter((o) => o.finished && strictlyAhead(o, me)).length
  if (guaranteedAhead >= advancing) return "out"
  // In if, even in the worst case (every unfinished group's third, plus every
  // finished third that ties or beats us, ends up ahead), fewer than `advancing`
  // teams are ahead of us.
  const couldBeAhead = others.filter((o) => !o.finished || maybeAhead(o, me)).length
  if (couldBeAhead < advancing) return "in"
  return "unknown"
}

const blankFasit = (): Fasit => ({
  groupQuestions: { gqA: "", gqB: "", gqC: "", gqD: "", gqF: "", gqG: "", gqI: "", gqK: "" },
  norway: { score7plus: "", concede4plus: "", meetBrazil: "", furthest: "", topScorer: "" },
  knockout: { swedenAdvances: "", europeanTeams: "", hostsAdvance: "", quarterfinalists: [], eliminated: [] },
  final: { team1: "", team2: "", score1: null, score2: null, champion: "", topScorerCountry: "" },
})

// Derives the answer key from live API data. A field is only filled once the
// matches behind it are actually decided; everything else stays blank/null so
// scoring treats it as "avventer" (pending), never awarding points on a
// provisional table.
export function deriveFasit(input: FasitInput, now: number): Fasit {
  const { matches, standings, scorers } = input
  const f = blankFasit()

  const toNo = (en: string | null | undefined): string =>
    en ? norwegianFromEnglish(en) ?? en : ""

  const letterOf = (g: string | null | undefined): string => {
    const m = (g ?? "").match(/([A-L])\s*$/i)
    return m ? m[1].toUpperCase() : ""
  }

  // --- group-stage helpers ------------------------------------------------
  const standingByLetter = new Map<string, ApiStanding>()
  for (const s of standings) {
    if (s.type !== "TOTAL") continue
    standingByLetter.set(letterOf(s.group), s)
  }

  const groupMatches = new Map<string, ApiMatch[]>()
  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE") continue
    const L = letterOf(m.group)
    const list = groupMatches.get(L) ?? []
    list.push(m)
    groupMatches.set(L, list)
  }
  const groupFinished = (L: string): boolean => {
    const ms = groupMatches.get(L) ?? []
    return ms.length > 0 && ms.every((m) => matchSettled(m, now))
  }

  const place = (L: string, pos: number): string => {
    if (!groupFinished(L)) return ""
    const row = standingByLetter.get(L)?.table.find((r) => r.position === pos)
    return row ? toNo(row.team.name) : ""
  }
  const findStanding = (noName: string) => {
    for (const [L, st] of standingByLetter) {
      const row = st.table.find((r) => toNo(r.team.name) === noName)
      if (row) return { letter: L, row }
    }
    return null
  }

  // --- knockout helpers ---------------------------------------------------
  const stageTeams = (stage: string): Set<string> => {
    const set = new Set<string>()
    for (const m of matches) {
      if (m.stage !== stage) continue
      if (m.homeTeam?.name) set.add(toNo(m.homeTeam.name))
      if (m.awayTeam?.name) set.add(toNo(m.awayTeam.name))
    }
    return set
  }
  // A knockout stage is "known" once every fixture in it has both real teams.
  const stageKnown = (stage: string): boolean => {
    const ms = matches.filter((m) => m.stage === stage)
    return ms.length > 0 && ms.every((m) => !!m.homeTeam?.name && !!m.awayTeam?.name)
  }

  const last32 = stageTeams("LAST_32")
  const last32Known = stageKnown("LAST_32")
  const finalMatch = matches.find((m) => m.stage === "FINAL") ?? null
  const tournamentOver = !!finalMatch && matchSettled(finalMatch, now)

  // --- group-stage advancement -------------------------------------------
  // Resolves as soon as it is mathematically certain, rather than waiting for the
  // whole group stage to finish (a clinched best-third would otherwise show as
  // "pending" until the last unrelated group kicked off).
  const thirdRecords: ThirdRecord[] = []
  for (const [L, st] of standingByLetter) {
    const r = st.table.find((x) => x.position === 3)
    if (r) {
      thirdRecords.push({
        letter: L,
        finished: groupFinished(L),
        pts: r.points,
        gd: r.goalsFor - r.goalsAgainst,
        gf: r.goalsFor,
      })
    }
  }
  // Has a team advanced from the group stage? Top two always go through, the bottom
  // team never does, and a third-placed team only as one of the best thirds. A team
  // already seeded into the knockout bracket is trivially "in".
  const groupAdvance = (noName: string): "in" | "out" | "unknown" => {
    if (last32.has(noName)) return "in"
    const st = findStanding(noName)
    if (!st || !groupFinished(st.letter)) return "unknown"
    if (st.row.position <= 2) return "in"
    if (st.row.position >= 4) return "out"
    return bestThirdOutcome(thirdRecords, st.letter)
  }

  // Deepest round a team has appeared in (fixtured or played).
  const reached = (noName: string): number => {
    let best = -1
    for (const m of matches) {
      const rank = STAGE_RANK[m.stage]
      if (rank === undefined) continue
      if (toNo(m.homeTeam?.name) === noName || toNo(m.awayTeam?.name) === noName) {
        best = Math.max(best, rank)
      }
    }
    return best
  }
  // True once a team can no longer progress: lost a knockout tie, or the group
  // stage is over and it isn't in the round of 32.
  const lostKnockout = (noName: string): boolean =>
    matches.some((m) => {
      if (m.stage === "GROUP_STAGE" || STAGE_RANK[m.stage] === undefined) return false
      if (!matchSettled(m, now) || !m.score?.winner) return false
      const h = toNo(m.homeTeam?.name)
      const a = toNo(m.awayTeam?.name)
      if (h !== noName && a !== noName) return false
      const won = (m.score.winner === "HOME_TEAM" && h === noName) || (m.score.winner === "AWAY_TEAM" && a === noName)
      return !won
    })
  const eliminated = (noName: string): boolean => lostKnockout(noName) || groupAdvance(noName) === "out"

  // === Group questions ====================================================
  f.groupQuestions.gqA = place("A", 1)
  f.groupQuestions.gqB = place("B", 2)
  f.groupQuestions.gqD = place("D", 1)
  f.groupQuestions.gqF = place("F", 1)
  f.groupQuestions.gqG = place("G", 1)
  f.groupQuestions.gqI = place("I", 2)
  // "Does the 3rd-placed team advance?" — resolves as soon as that team has clinched
  // or been eliminated from the best-third places, not only once the bracket is set.
  const thirdAdvances = (L: string): string => {
    if (!groupFinished(L)) return ""
    const third = standingByLetter.get(L)?.table.find((r) => r.position === 3)
    if (!third) return ""
    const outcome = groupAdvance(toNo(third.team.name))
    return outcome === "in" ? "J" : outcome === "out" ? "N" : ""
  }
  f.groupQuestions.gqC = thirdAdvances("C")
  f.groupQuestions.gqK = thirdAdvances("K")

  // === Norway =============================================================
  const norway = findStanding("Norge")
  if (norway && groupFinished(norway.letter)) {
    f.norway.score7plus = norway.row.goalsFor >= 7 ? "J" : "N"
    f.norway.concede4plus = norway.row.goalsAgainst >= 4 ? "J" : "N"
  }
  // Norway meets Brazil in the knockout: "J" as soon as such a tie exists,
  // "N" once it can no longer happen.
  const norwayMeetsBrazil = matches.some((m) => {
    if (m.stage === "GROUP_STAGE" || STAGE_RANK[m.stage] === undefined) return false
    const pair = [toNo(m.homeTeam?.name), toNo(m.awayTeam?.name)]
    return pair.includes("Norge") && pair.includes("Brasil")
  })
  if (norwayMeetsBrazil) f.norway.meetBrazil = "J"
  else if (tournamentOver || eliminated("Norge") || eliminated("Brasil")) f.norway.meetBrazil = "N"

  // Furthest of Norway / England - once neither can progress further.
  if (tournamentOver || (eliminated("Norge") && eliminated("England"))) {
    const rn = reached("Norge")
    const re = reached("England")
    f.norway.furthest = rn > re ? "Norge" : re > rn ? "England" : "Like langt"
  }

  // Norway's top scorer - fixed once Norway is out (or the VM is over).
  if (tournamentOver || eliminated("Norge")) {
    const top = scorers.find((s) => toNo(s.team.name) === "Norge")
    if (top) {
      const name = top.player.name
      f.norway.topScorer = /haaland/i.test(name)
        ? "Haaland"
        : /s(ø|o)rloth/i.test(name)
          ? "Sørloth"
          : "En annen"
    }
  }

  // === Knockout ===========================================================
  const swedenOutcome = groupAdvance("Sverige")
  if (swedenOutcome === "in") f.knockout.swedenAdvances = "J"
  else if (swedenOutcome === "out") f.knockout.swedenAdvances = "N"

  if (last32Known) {
    f.knockout.europeanTeams = String([...last32].filter((t) => EUROPEAN_TEAMS.has(t)).length)
  }

  if (stageKnown("LAST_16")) {
    const last16 = stageTeams("LAST_16")
    const advancing = HOSTS.filter((h) => last16.has(h))
    f.knockout.hostsAdvance = advancing.length ? advancing.join(" og ") : "Ingen"
  }

  if (stageKnown("QUARTER_FINALS")) {
    f.knockout.quarterfinalists = [...stageTeams("QUARTER_FINALS")]
  }

  // Every team known to be knocked out (lost a knockout tie, or didn't advance from
  // the group). Lets the UI mark QF picks on these teams as wrong before the full
  // quarterfinal lineup is settled. Drawn from the group tables, so it covers all
  // participants, not just those that reached the bracket.
  const allTeams = new Set<string>()
  for (const st of standingByLetter.values()) {
    for (const row of st.table) allTeams.add(toNo(row.team.name))
  }
  f.knockout.eliminated = [...allTeams].filter((t) => t && eliminated(t))

  // === Final ==============================================================
  if (finalMatch?.homeTeam?.name && finalMatch.awayTeam?.name) {
    f.final.team1 = toNo(finalMatch.homeTeam.name)
    f.final.team2 = toNo(finalMatch.awayTeam.name)
  }
  if (tournamentOver && finalMatch?.score) {
    f.final.score1 = finalMatch.score.fullTime.home
    f.final.score2 = finalMatch.score.fullTime.away
    if (finalMatch.score.winner === "HOME_TEAM") f.final.champion = toNo(finalMatch.homeTeam?.name)
    else if (finalMatch.score.winner === "AWAY_TEAM") f.final.champion = toNo(finalMatch.awayTeam?.name)
  }
  if (tournamentOver && scorers.length) {
    f.final.topScorerCountry = toNo(scorers[0].team.name)
  }

  return f
}
