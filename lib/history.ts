import { kickoffMs, MATCH_DURATION_MS } from "./match-time"
import type { Match, MatchResult, ScoreBreakdown } from "./types"

// Tournament span - used as the fixed x-axis bounds of the history graph.
export const VM_START = Date.UTC(2026, 5, 11, 13, 0) // 11 Jun 2026, first kickoff
export const VM_END = Date.UTC(2026, 6, 19, 21, 0) // 19 Jul 2026, final

// Fallback stage end-dates for the 2026 World Cup, used only when the live
// schedule isn't available. Normally a bonus question is timestamped with the real
// completion time of the match that actually decided it (see DecisionTimes).
const GROUP_STAGE_END = Date.UTC(2026, 5, 27, 21, 0) // 27 Jun
const R32_END = Date.UTC(2026, 6, 3, 21, 0) // 3 Jul
const R16_END = Date.UTC(2026, 6, 7, 21, 0) // 7 Jul
const SF_END = Date.UTC(2026, 6, 15, 21, 0) // 15 Jul

type BonusGroup = "groupQuestions" | "norway" | "knockout" | "final"

// Real completion timestamps of the matches that decide each bet, derived from the
// live schedule in lib/timeline.ts. All values are "ms since epoch", or null/absent
// while the deciding match hasn't been played yet.
export type DecisionTimes = {
  groupLast: Record<string, number> // group letter -> last group match completed
  groupStageEnd: number | null // last group match overall
  stageEnd: Record<string, number> // API stage name (LAST_32, …, FINAL) -> last match completed
  norwayGroupEnd: number | null // Norway's last group match completed
  teamLast: Record<string, number> // Norwegian team name -> that team's last match completed
  norwayBrazil: number | null // a Norway–Brazil knockout tie, if one exists
}

// Best-effort milestone used when the live schedule can't be fetched.
function milestoneFallback(group: BonusGroup, key: string): number {
  if (group === "groupQuestions") return GROUP_STAGE_END
  if (group === "norway") {
    if (key === "score7plus" || key === "concede4plus") return GROUP_STAGE_END
    if (key === "meetBrazil" || key === "furthest") return SF_END
    return VM_END // topScorer
  }
  if (group === "knockout") {
    if (key === "swedenAdvances" || key === "europeanTeams") return GROUP_STAGE_END
    if (key === "hostsAdvance") return R32_END
    return R16_END // quarterfinalists
  }
  if (key === "teams") return SF_END
  return VM_END // score, champion, topScorerCountry
}

// When a bonus answer became known: the completion time of the match that decided
// it. Falls back to a fixed milestone if that match isn't in the schedule yet.
function bonusDecidedAt(group: BonusGroup, key: string, dt: DecisionTimes | null): number {
  const fb = milestoneFallback(group, key)
  if (!dt) return fb
  const pos = (v: number | null | undefined): number | null => (v && v > 0 ? v : null)
  // Latest of several teams' final matches — only once every named team is out.
  const allTeams = (...names: string[]): number | null => {
    const vals = names.map((n) => dt.teamLast[n]).filter((v): v is number => !!v && v > 0)
    return vals.length === names.length ? Math.max(...vals) : null
  }

  switch (group) {
    case "groupQuestions": {
      const L = key.slice(2).toUpperCase()
      if (L === "C" || L === "K") return pos(dt.groupStageEnd) ?? fb // 3rd-place needs all groups done
      return pos(dt.groupLast[L]) ?? pos(dt.groupStageEnd) ?? fb
    }
    case "norway":
      if (key === "score7plus" || key === "concede4plus") return pos(dt.norwayGroupEnd) ?? pos(dt.groupStageEnd) ?? fb
      if (key === "meetBrazil") return pos(dt.norwayBrazil) ?? allTeams("Norge", "Brasil") ?? fb
      if (key === "furthest") return allTeams("Norge", "England") ?? fb
      return pos(dt.teamLast["Norge"]) ?? fb // topScorer (known when Norway is out)
    case "knockout":
      if (key === "swedenAdvances" || key === "europeanTeams") return pos(dt.groupStageEnd) ?? fb
      if (key === "hostsAdvance") return pos(dt.stageEnd["LAST_32"]) ?? fb // R16 line-up set after R32
      return pos(dt.stageEnd["LAST_16"]) ?? fb // quarterfinalists set after R16
    case "final":
      if (key === "teams") return pos(dt.stageEnd["SEMI_FINALS"]) ?? fb
      return pos(dt.stageEnd["FINAL"]) ?? fb // score, champion, topScorerCountry
  }
  return fb
}

export type HistoryPoint = { t: number; p: number }
export type HistorySeries = { name: string; total: number; points: HistoryPoint[] }
export type StandingsHistoryData = { series: HistorySeries[]; start: number; end: number; now: number }

// Builds a cumulative points-over-time series for every contestant. Both tracked
// matches and bonus questions are credited at the real completion time of the match
// that decided them. Only points already earned (decided) appear, so each line ends
// at the contestant's current total.
export function buildHistory(
  standings: ScoreBreakdown[],
  matches: Match[],
  results: Record<string, MatchResult>,
  now: number,
  decisionTimes: DecisionTimes | null = null,
): StandingsHistoryData {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const clamp = (t: number) => Math.min(Math.max(t, VM_START), Math.min(now, VM_END))

  const series = standings.map((bd): HistorySeries => {
    const events: HistoryPoint[] = []

    for (const m of bd.matches) {
      if (!m.settled || m.points <= 0) continue
      const match = matchById.get(m.id)
      const ko = match ? kickoffMs(match, results[m.id]) : null
      const t = ko != null ? ko + MATCH_DURATION_MS : GROUP_STAGE_END
      events.push({ t: clamp(t), p: m.points })
    }

    for (const group of ["groupQuestions", "norway", "knockout", "final"] as const) {
      for (const [key, line] of Object.entries(bd.bonus[group])) {
        if (line.status === "pending" || line.points <= 0) continue
        events.push({ t: clamp(bonusDecidedAt(group, key, decisionTimes)), p: line.points })
      }
    }

    events.sort((a, b) => a.t - b.t)
    let acc = 0
    const points: HistoryPoint[] = []
    for (const e of events) {
      acc += e.p
      // Merge events that land on the same timestamp into one step.
      const last = points[points.length - 1]
      if (last && last.t === e.t) last.p = acc
      else points.push({ t: e.t, p: acc })
    }

    return { name: bd.name, total: bd.total, points }
  })

  return { series, start: VM_START, end: VM_END, now: Math.min(Math.max(now, VM_START), VM_END) }
}
