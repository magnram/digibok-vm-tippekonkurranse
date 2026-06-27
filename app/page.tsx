import predictions from "@/lib/data/predictions.json"
import { getResults } from "@/lib/results"
import { buildStandings } from "@/lib/scoring"
import { matchPhase } from "@/lib/match-time"
import type { MatchPhase, PredictionData } from "@/lib/types"
import { ContestApp } from "@/components/contest-app"
import { SiteHeader } from "@/components/site-header"

// Rendered per request: results come from Postgres (cheap), and getResults only
// calls the football-data.org API when the cache is stale. Avoids needing the DB
// at build time and keeps match phases current.
export const dynamic = "force-dynamic"

export default async function Page() {
  const data = predictions as PredictionData
  const { results, source, fetchedAt, note } = await getResults()
  const standings = buildStandings(data.contestants, results)

  // Derive each fixture's display phase on the server (so it's hydration-stable).
  const now = Date.now()
  const phases: Record<string, MatchPhase> = {}
  for (const m of data.matches) {
    phases[m.id] = matchPhase(m, results[m.id], now)
  }

  const settledCount = data.matches.filter((m) => results[m.id]?.final).length

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        source={source}
        fetchedAt={fetchedAt}
        note={note}
        settledCount={settledCount}
        totalMatches={data.matches.length}
        contestantCount={data.contestants.length}
        leader={standings[0]?.name}
      />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 md:pt-8">
        <ContestApp
          standings={standings}
          matches={data.matches}
          contestants={data.contestants}
          groupQuestions={data.groupQuestions}
          results={results}
          phases={phases}
        />
      </main>
    </div>
  )
}
