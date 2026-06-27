"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GroupQuestion, Match, Contestant, MatchPhase, MatchResult, ScoreBreakdown } from "@/lib/types"
import { StandingsTable } from "@/components/standings-table"
import { MatchesList } from "@/components/matches-list"
import { ContestantDetail } from "@/components/contestant-detail"

export function ContestApp({
  standings,
  matches,
  contestants,
  groupQuestions,
  results,
  phases,
}: {
  standings: ScoreBreakdown[]
  matches: Match[]
  contestants: Contestant[]
  groupQuestions: GroupQuestion[]
  results: Record<string, MatchResult>
  phases: Record<string, MatchPhase>
}) {
  const [tab, setTab] = useState("standings")
  const [selected, setSelected] = useState<string | null>(null)

  function openContestant(name: string) {
    setSelected(name)
    setTab("contestant")
  }

  const selectedContestant = contestants.find((c) => c.name === selected) ?? null
  const selectedScore = standings.find((s) => s.name === selected) ?? null

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="standings">Stilling</TabsTrigger>
        <TabsTrigger value="matches">Kamper</TabsTrigger>
        <TabsTrigger value="contestant" disabled={!selectedContestant}>
          Deltaker
        </TabsTrigger>
      </TabsList>

      <TabsContent value="standings" className="mt-5">
        <StandingsTable standings={standings} onSelect={openContestant} />
      </TabsContent>

      <TabsContent value="matches" className="mt-5">
        <MatchesList matches={matches} results={results} contestants={contestants} phases={phases} />
      </TabsContent>

      <TabsContent value="contestant" className="mt-5">
        {selectedContestant && selectedScore ? (
          <ContestantDetail
            contestant={selectedContestant}
            score={selectedScore}
            matches={matches}
            groupQuestions={groupQuestions}
            results={results}
            phases={phases}
            rank={standings.findIndex((s) => s.name === selected) + 1}
            onBack={() => setTab("standings")}
          />
        ) : null}
      </TabsContent>
    </Tabs>
  )
}
