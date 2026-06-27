import { Suspense } from "react"
import predictions from "@/lib/data/predictions.json"
import { getResults } from "@/lib/results"
import { getFasit } from "@/lib/fasit"
import { buildStandings, perfectTotal } from "@/lib/scoring"
import { buildHistory } from "@/lib/history"
import { getDecisionTimes } from "@/lib/timeline"
import { matchPhase } from "@/lib/match-time"
import type { AnswerLine, MatchPhase, PredictionData, ScoreBreakdown } from "@/lib/types"
import { ContestApp } from "@/components/contest-app"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

// Rendered per request: results come from Postgres (cheap), and getResults only
// calls the football-data.org API when the cache is stale. Avoids needing the DB
// at build time and keeps match phases current.
export const dynamic = "force-dynamic"

// All non-match (bonus) answer lines for one contestant — used to count how many
// of the side-questions are decided so far.
function bonusLines(s: ScoreBreakdown): AnswerLine[] {
  return [s.bonus.groupQuestions, s.bonus.norway, s.bonus.knockout, s.bonus.final].flatMap((g) =>
    Object.values(g),
  )
}

export default async function Page() {
  const data = predictions as PredictionData
  const [{ results, source, fetchedAt, note }, fasit, decisionTimes] = await Promise.all([
    getResults(),
    getFasit(),
    getDecisionTimes(),
  ])
  const standings = buildStandings(data.contestants, results, fasit)

  // Derive each fixture's display phase on the server (so it's hydration-stable).
  const now = Date.now()
  const phases: Record<string, MatchPhase> = {}
  for (const m of data.matches) {
    phases[m.id] = matchPhase(m, results[m.id], now)
  }

  const history = buildHistory(standings, data.matches, results, now, decisionTimes)

  // Header progress: tracked matches settled, bonus questions decided, and the
  // overall share of available points that have been locked in.
  const settledCount = data.matches.filter((m) => results[m.id]?.final).length
  const sample = standings[0]
  const lines = sample ? bonusLines(sample) : []
  const decidedLines = lines.filter((l) => l.status !== "pending")
  const totalQuestions = lines.length
  const decidedQuestions = decidedLines.length
  const perfect = sample ? perfectTotal(sample) : 0
  const decidedPoints = settledCount * 2 + decidedLines.reduce((s, l) => s + l.max, 0)
  const contestProgress = perfect ? Math.round((decidedPoints / perfect) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        source={source}
        fetchedAt={fetchedAt}
        note={note}
        settledCount={settledCount}
        totalMatches={data.matches.length}
        decidedQuestions={decidedQuestions}
        totalQuestions={totalQuestions}
        contestantCount={data.contestants.length}
        leader={standings[0]?.name}
        leaderPoints={standings[0]?.total}
        contestProgress={contestProgress}
      />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 md:pt-8">
        <Suspense fallback={null}>
          <ContestApp
            standings={standings}
            matches={data.matches}
            contestants={data.contestants}
            groupQuestions={data.groupQuestions}
            results={results}
            phases={phases}
            history={history}
          />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
