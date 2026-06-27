import predictions from "@/lib/data/predictions.json"
import { getResults } from "@/lib/results"
import { buildStandings } from "@/lib/scoring"
import type { PredictionData } from "@/lib/types"
import { ContestApp } from "@/components/contest-app"
import { SiteHeader } from "@/components/site-header"

export const revalidate = 300

export default async function Page() {
  const data = predictions as PredictionData
  const { results, source, fetchedAt, note } = await getResults()
  const standings = buildStandings(data.contestants, results)

  const settledCount = data.matches.filter((m) => results[m.id]?.status === "FINISHED").length

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
        />
      </main>
    </div>
  )
}
