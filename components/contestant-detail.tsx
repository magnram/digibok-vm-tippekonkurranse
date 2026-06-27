"use client"

import { ArrowLeft, X } from "lucide-react"
import { Flag } from "@/components/flag"
import type { Contestant, GroupQuestion, Match, MatchResult, ScoreBreakdown } from "@/lib/types"
import { cn } from "@/lib/utils"

function JN({ value }: { value: string }) {
  const v = (value || "").toUpperCase()
  const label = v === "J" ? "Ja" : v === "N" ? "Nei" : value || "—"
  return <span className="font-medium text-foreground">{label}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

export function ContestantDetail({
  contestant,
  score,
  matches,
  groupQuestions,
  results,
  rank,
  onBack,
}: {
  contestant: Contestant
  score: ScoreBreakdown
  matches: Match[]
  groupQuestions: GroupQuestion[]
  results: Record<string, MatchResult>
  rank: number
  onBack: () => void
}) {
  const c = contestant

  return (
    <section aria-label={`Tips for ${c.name}`}>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tilbake til stillingen
      </button>

      {/* Summary card */}
      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-primary p-4 text-primary-foreground">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
            Plassering #{rank}
          </p>
          <h2 className="truncate text-xl font-bold">{c.name}</h2>
        </div>
        <div className="flex shrink-0 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold tabular-nums">{score.total}</div>
            <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">
              poeng
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">{score.exactPoints}</div>
            <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">
              blink
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Group matches */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Gruppespillskamper</h3>
          <div className="flex flex-col gap-1.5">
            {matches.map((m) => {
              const pm = c.groupMatches.find((g) => g.id === m.id)
              const r = results[m.id]
              const settled = r?.status === "FINISHED"
              const mb = score.matches.find((x) => x.id === m.id)
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg bg-secondary/30 px-2.5 py-2 text-sm"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-bold text-secondary-foreground">
                    {m.group}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                    <span className="truncate">{m.home}</span>
                    <Flag team={m.home} className="h-3 w-4" />
                  </span>
                  <span className="shrink-0 rounded bg-card px-1.5 py-0.5 font-semibold tabular-nums">
                    {pm && pm.home != null ? `${pm.home}–${pm.away}` : "—"}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Flag team={m.away} className="h-3 w-4" />
                    <span className="truncate">{m.away}</span>
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    {settled ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r!.home}–{r!.away}
                        </span>
                        {mb && mb.points > 0 ? (
                          <span
                            className={cn(
                              "rounded px-1 text-[10px] font-semibold",
                              mb.exactHit
                                ? "bg-accent text-accent-foreground"
                                : "bg-primary/15 text-primary",
                            )}
                          >
                            +{mb.points}
                          </span>
                        ) : (
                          <X className="size-3.5 text-muted-foreground" />
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">venter</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <SectionCard title="Grupper (2 poeng per rett)">
          {groupQuestions.map((q) => (
            <Row key={q.key} label={q.text}>
              <span className="font-medium text-foreground">
                {c.groupQuestions[q.key] || "—"}
              </span>
            </Row>
          ))}
        </SectionCard>

        <SectionCard title="Norge (2 poeng per rett)">
          <Row label="Scorer Norge 7+ mål i gruppespillet?">
            <JN value={c.norway.score7plus} />
          </Row>
          <Row label="Slipper Norge inn 4+ mål i gruppespillet?">
            <JN value={c.norway.concede4plus} />
          </Row>
          <Row label="Møter Norge Brasil i finalespillet?">
            <JN value={c.norway.meetBrazil} />
          </Row>
          <Row label="Hvem når lengst av Norge og England?">
            <span className="font-medium text-foreground">{c.norway.furthest || "—"}</span>
          </Row>
          <Row label="Norges toppscorer">
            <span className="font-medium text-foreground">{c.norway.topScorer || "—"}</span>
          </Row>
        </SectionCard>

        <SectionCard title="Sluttspillet (2 poeng per rett)">
          <Row label="Går Sverige videre fra gruppespillet?">
            <JN value={c.knockout.swedenAdvances} />
          </Row>
          <Row label="Antall europeiske lag til sekstendedelsfinale">
            <span className="font-medium text-foreground">{c.knockout.europeanTeams || "—"}</span>
          </Row>
          <Row label="Vertsnasjon(er) videre til åttendedelsfinale">
            <span className="font-medium text-foreground">{c.knockout.hostsAdvance || "—"}</span>
          </Row>
          <div className="py-2">
            <span className="text-sm text-muted-foreground">8 land til kvartfinale</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.knockout.quarterfinalists.length ? (
                c.knockout.quarterfinalists.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    <Flag team={t} className="h-3 w-4" />
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-sm text-foreground">—</span>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Finalen">
          <Row label="Finalelag (4 poeng)">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Flag team={c.final.team1} className="h-3 w-4" />
                {c.final.team1 || "—"}
              </span>
              <span className="text-muted-foreground">vs</span>
              <span className="inline-flex items-center gap-1.5">
                <Flag team={c.final.team2} className="h-3 w-4" />
                {c.final.team2 || "—"}
              </span>
            </span>
          </Row>
          <Row label="Målscore etter 90 min (3 poeng)">
            <span className="font-medium tabular-nums text-foreground">
              {c.final.score1 != null ? `${c.final.score1}–${c.final.score2}` : "—"}
            </span>
          </Row>
          <Row label="Verdensmester (5 poeng)">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Flag team={c.final.champion} className="h-3 w-4" />
              {c.final.champion || "—"}
            </span>
          </Row>
          <Row label="VMs toppscorer fra land (3 poeng)">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Flag team={c.final.topScorerCountry} className="h-3 w-4" />
              {c.final.topScorerCountry || "—"}
            </span>
          </Row>
        </SectionCard>
      </div>
    </section>
  )
}
