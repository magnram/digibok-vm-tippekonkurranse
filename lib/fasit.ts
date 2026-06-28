import "server-only"
import manualFasit from "./data/fasit.json"
import { deriveFasit } from "./fasit-derive"
import { getWcData } from "./wc-api"
import type { Fasit } from "./types"

const MANUAL = manualFasit as Fasit

// Returns the answer key used for scoring: the fasit derived from the shared WC
// snapshot (lib/wc-api.ts), with the manual fasit.json overlaid on top (a manually
// entered value always wins). Deriving is in-memory and cheap; the snapshot itself
// is Postgres-cached and frozen once the tournament is over, so no API call is made
// here. Falls back to the manual file if the snapshot is unavailable.
export async function getFasit(): Promise<Fasit> {
  const data = await getWcData()
  if (!data) return MANUAL
  return merge(deriveFasit({ matches: data.matches, standings: data.standings, scorers: data.scorers }))
}

// Overlays manually-entered answers (fasit.json) on top of the derived ones.
function merge(derived: Fasit): Fasit {
  const has = (s: string | null | undefined) => !!s && s.trim() !== "" && s.trim() !== "-"
  const pick = (m: string, d: string) => (has(m) ? m : d)

  return {
    groupQuestions: Object.fromEntries(
      Object.keys(derived.groupQuestions).map((k) => [
        k,
        pick(MANUAL.groupQuestions?.[k] ?? "", derived.groupQuestions[k]),
      ]),
    ),
    norway: {
      score7plus: pick(MANUAL.norway.score7plus, derived.norway.score7plus),
      concede4plus: pick(MANUAL.norway.concede4plus, derived.norway.concede4plus),
      meetBrazil: pick(MANUAL.norway.meetBrazil, derived.norway.meetBrazil),
      furthest: pick(MANUAL.norway.furthest, derived.norway.furthest),
      topScorer: pick(MANUAL.norway.topScorer, derived.norway.topScorer),
    },
    knockout: {
      swedenAdvances: pick(MANUAL.knockout.swedenAdvances, derived.knockout.swedenAdvances),
      europeanTeams: pick(MANUAL.knockout.europeanTeams, derived.knockout.europeanTeams),
      hostsAdvance: pick(MANUAL.knockout.hostsAdvance, derived.knockout.hostsAdvance),
      quarterfinalists: MANUAL.knockout.quarterfinalists?.length
        ? MANUAL.knockout.quarterfinalists
        : derived.knockout.quarterfinalists,
      eliminated: derived.knockout.eliminated ?? [],
    },
    final: {
      team1: pick(MANUAL.final.team1, derived.final.team1),
      team2: pick(MANUAL.final.team2, derived.final.team2),
      score1: MANUAL.final.score1 != null ? MANUAL.final.score1 : derived.final.score1,
      score2: MANUAL.final.score2 != null ? MANUAL.final.score2 : derived.final.score2,
      champion: pick(MANUAL.final.champion, derived.final.champion),
      topScorerCountry: pick(MANUAL.final.topScorerCountry, derived.final.topScorerCountry),
    },
  }
}
