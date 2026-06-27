"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Flag } from "@/components/flag"
import type { Match, MatchPhase, MatchResult, Contestant } from "@/lib/types"
import { cn } from "@/lib/utils"

function outcome(h: number, a: number) {
  if (h > a) return "H"
  if (h < a) return "B"
  return "U"
}

function StatusBadge({ phase }: { phase: MatchPhase }) {
  if (phase === "finished") {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
        Ferdig
      </span>
    )
  }
  if (phase === "live") {
    return (
      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
        Spilles nå
      </span>
    )
  }
  if (phase === "awaiting") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Henter resultat
      </span>
    )
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Kommende
    </span>
  )
}

export function MatchesList({
  matches,
  results,
  contestants,
  phases,
}: {
  matches: Match[]
  results: Record<string, MatchResult>
  contestants: Contestant[]
  phases: Record<string, MatchPhase>
}) {
  return (
    <section aria-label="Kamper">
      <div className="mb-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">Gruppespillskamper</h2>
        <p className="text-xs text-muted-foreground">
          Resultater hentes automatisk. Åpne en kamp for å se alles tips.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            result={results[m.id]}
            phase={phases[m.id] ?? "upcoming"}
            contestants={contestants}
          />
        ))}
      </div>
    </section>
  )
}

function MatchCard({
  match,
  result,
  phase,
  contestants,
}: {
  match: Match
  result?: MatchResult
  phase: MatchPhase
  contestants: Contestant[]
}) {
  const [open, setOpen] = useState(false)
  const settled = phase === "finished" && result?.home != null && result?.away != null
  const actualOutcome = settled ? outcome(result!.home!, result!.away!) : null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="flex w-14 shrink-0 flex-col items-center gap-1">
          <span className="flex size-6 items-center justify-center rounded-md bg-secondary text-[11px] font-bold text-secondary-foreground">
            {match.group}
          </span>
          <span className="text-[10px] text-muted-foreground">{match.date.slice(0, 5)}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-sm font-medium">
              <span className="truncate">{match.home}</span>
              <Flag team={match.home} className="h-3.5 w-5" />
            </span>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-sm font-bold tabular-nums",
                settled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {settled ? `${result!.home} – ${result!.away}` : phase === "live" ? "live" : "–"}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
              <Flag team={match.away} className="h-3.5 w-5" />
              <span className="truncate">{match.away}</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <StatusBadge phase={phase} />
          </div>
        </div>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="border-t border-border bg-secondary/20 px-3 py-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {contestants.map((c) => {
              const pm = c.groupMatches.find((g) => g.id === match.id)
              const has = pm && pm.home != null && pm.away != null
              const predOutcome = has ? outcome(pm!.home!, pm!.away!) : null
              const exactHit = settled && has && pm!.home === result!.home && pm!.away === result!.away
              const outcomeHit = settled && predOutcome === actualOutcome
              const pts = settled ? (exactHit ? 2 : outcomeHit ? 1 : 0) : null
              return (
                <div
                  key={c.name}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
                    exactHit
                      ? "border-accent/50 bg-accent/15"
                      : outcomeHit
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent bg-card",
                  )}
                >
                  <span className="truncate text-foreground">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-foreground">
                      {has ? `${pm!.home}–${pm!.away}` : "—"}
                    </span>
                    {pts != null ? (
                      <span
                        className={cn(
                          "w-9 rounded-md px-1 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                          pts === 2
                            ? "bg-accent text-accent-foreground"
                            : pts === 1
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {pts}p
                      </span>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
          {settled ? (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Uthevet = riktig resultat (2p, gull) eller riktig utfall (1p, grønn)
            </p>
          ) : (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Poeng vises når kampen er ferdigspilt
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
