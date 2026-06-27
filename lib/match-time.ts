import type { Match, MatchPhase, MatchResult } from "./types"

// The contest spreadsheet lists kickoff times in Norwegian local time. The whole
// 2026 World Cup (11 June – 19 July) falls inside daylight-saving time, so Oslo
// is UTC+2 (CEST) for every fixture - no DST transition to worry about.
const OSLO_UTC_OFFSET_HOURS = 2

// A football match is over roughly two hours after kickoff (90 min + half-time +
// stoppage). We give the result feed an extra buffer before assuming a played
// match's result simply hasn't been fetched yet.
export const MATCH_DURATION_MS = 2.5 * 60 * 60 * 1000

// Resolves a fixture's kickoff to a UTC timestamp (ms). Prefers the API's
// authoritative `utcDate` when we have it, and otherwise parses the spreadsheet's
// "dd.mm.yyyy" + "HH:MM" (interpreted as Europe/Oslo).
export function kickoffMs(match: Match, result?: MatchResult): number | null {
  if (result?.utcDate) {
    const t = Date.parse(result.utcDate)
    if (!Number.isNaN(t)) return t
  }
  const dm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(match.date)
  const tm = /^(\d{1,2}):(\d{2})$/.exec(match.time)
  if (!dm || !tm) return null
  const [, dd, mm, yyyy] = dm
  const [, hh, min] = tm
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) - OSLO_UTC_OFFSET_HOURS, Number(min))
}

const FINAL_STATUSES = new Set(["FINISHED", "AWARDED"])

// Whether a result can be treated as the final score for scoring.
// Either the feed explicitly says so, or the match has a score and its kickoff is
// far enough in the past that it must be over - this guards against the feed
// leaving a played match stuck on a live/scheduled status.
export function isFinalResult(match: Match, result: MatchResult | undefined, now: number): boolean {
  if (!result || result.home == null || result.away == null) return false
  if (FINAL_STATUSES.has(result.status)) return true
  const ko = kickoffMs(match, result)
  return ko != null && now - ko > MATCH_DURATION_MS
}

// Derives the display phase for a fixture from its result and scheduled kickoff.
// `awaiting` means the match should have been played by now but we don't have a
// final result yet - distinct from `upcoming`, which means it hasn't kicked off.
export function matchPhase(match: Match, result: MatchResult | undefined, now: number): MatchPhase {
  if (result?.final) return "finished"
  if (result?.status === "IN_PLAY" || result?.status === "PAUSED") return "live"
  const ko = kickoffMs(match, result)
  if (ko == null) return result ? "awaiting" : "upcoming"
  if (now - ko > MATCH_DURATION_MS) return "awaiting"
  if (now >= ko) return "live"
  return "upcoming"
}
