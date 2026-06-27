"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type {
  GroupQuestion,
  Match,
  Contestant,
  MatchPhase,
  MatchResult,
  ScoreBreakdown,
} from "@/lib/types"
import type { StandingsHistoryData } from "@/lib/history"
import { StandingsTable } from "@/components/standings-table"
import { ContestantDetail } from "@/components/contestant-detail"

// Which contestant is open is stored in the URL (?deltaker=Navn) so the browser
// back/forward buttons navigate between the standings and a player, and a player
// view is directly shareable/bookmarkable.
const PARAM = "deltaker"

export function ContestApp({
  standings,
  matches,
  contestants,
  groupQuestions,
  results,
  phases,
  history,
}: {
  standings: ScoreBreakdown[]
  matches: Match[]
  contestants: Contestant[]
  groupQuestions: GroupQuestion[]
  results: Record<string, MatchResult>
  phases: Record<string, MatchPhase>
  history: StandingsHistoryData
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = searchParams.get(PARAM)

  const select = useCallback(
    (name: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set(PARAM, name)
      router.push(`${pathname}?${sp.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const back = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const selectedContestant = selected ? contestants.find((c) => c.name === selected) ?? null : null
  const selectedScore = selected ? standings.find((s) => s.name === selected) ?? null : null

  if (selectedContestant && selectedScore) {
    return (
      <ContestantDetail
        contestant={selectedContestant}
        score={selectedScore}
        contestants={contestants}
        standings={standings}
        matches={matches}
        groupQuestions={groupQuestions}
        results={results}
        phases={phases}
        history={history}
        rank={standings.findIndex((s) => s.name === selected) + 1}
        onBack={back}
      />
    )
  }

  return <StandingsTable standings={standings} history={history} onSelect={select} />
}
