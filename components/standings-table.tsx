"use client"

import { ChevronRight, Crown } from "lucide-react"
import type { ScoreBreakdown } from "@/lib/types"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function StandingsTable({
  standings,
  onSelect,
}: {
  standings: ScoreBreakdown[]
  onSelect: (name: string) => void
}) {
  const maxTotal = Math.max(1, ...standings.map((s) => s.total))

  return (
    <section aria-label="Stilling">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">Sammenlagt stilling</h2>
        <span className="text-xs text-muted-foreground">Trykk på en deltaker for detaljer</span>
      </div>

      <ol className="flex flex-col gap-2">
        {standings.map((s, i) => {
          const rank = i + 1
          const isLeader = rank === 1 && s.total > 0
          return (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => onSelect(s.name)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50",
                  isLeader && "border-accent/60 bg-accent/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                    rank === 1 && "bg-accent text-accent-foreground",
                    rank === 2 && "bg-secondary text-secondary-foreground",
                    rank === 3 && "bg-secondary text-secondary-foreground",
                    rank > 3 && "bg-muted text-muted-foreground",
                  )}
                >
                  {rank}
                </span>

                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(s.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">{s.name}</span>
                    {isLeader ? (
                      <Crown className="size-3.5 shrink-0 text-accent" aria-label="Leder" />
                    ) : null}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(s.total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 text-right">
                  <div>
                    <div className="text-lg font-bold tabular-nums text-foreground">{s.total}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      poeng
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        Poengene beregnes fra gruppespillskampene som er ferdigspilt: 1 poeng for riktig utfall
        (H/U/B) og 1 poeng for riktig sluttresultat. Spørsmål om grupper, sluttspill og finalen
        avgjøres senere i turneringen.
      </p>
    </section>
  )
}
