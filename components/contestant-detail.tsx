"use client"

import { useState } from "react"
import { ArrowLeft, ChevronDown, Check, X, Sparkles, LayoutGrid, Swords, Medal } from "lucide-react"
import { Flag } from "@/components/flag"
import { StandingsHistory } from "@/components/standings-history"
import type { StandingsHistoryData } from "@/lib/history"
import { perfectTotal } from "@/lib/scoring"
import type {
  AnswerLine,
  AnswerStatus,
  Contestant,
  GroupQuestion,
  Match,
  MatchPhase,
  MatchResult,
  ScoreBreakdown,
} from "@/lib/types"
import { cn } from "@/lib/utils"

type BonusGroup = "groupQuestions" | "norway" | "knockout" | "final"

// One contestant's answer to a single question, with how it scored.
type Guess = {
  name: string
  value: string
  points: number | null // null while the question is still pending
  status: AnswerStatus | null // null = not yet decided for this contestant
  selected: boolean
}

function jn(value: string): string {
  const v = (value || "").toUpperCase()
  if (v === "J") return "Ja"
  if (v === "N") return "Nei"
  return value || "-"
}

// Compact status pill: open (still winnable), earned, or lost.
function PointsBadge({ line }: { line?: AnswerLine }) {
  if (!line || line.status === "pending") {
    // Points still winnable: the line's max, minus anything already forfeited
    // (e.g. QF picks on knocked-out teams).
    const possible = (line?.max ?? 0) - (line?.forfeited ?? 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        +{possible} mulig
      </span>
    )
  }
  if (line.points > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          line.status === "correct" ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary",
        )}
      >
        {line.status === "correct" ? <Check className="size-3" /> : null}+{line.points}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <X className="size-3" />0
    </span>
  )
}

function GuessCell({ g }: { g: Guess }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
        g.status === "correct"
          ? "border-accent/50 bg-accent/15"
          : g.status === "partial"
            ? "border-primary/30 bg-primary/5"
            : "border-transparent bg-card",
        g.selected && "ring-1 ring-primary/50",
      )}
    >
      <span className="min-w-0 max-w-[45%] shrink-0 truncate text-foreground">{g.name}</span>
      <span className="flex min-w-0 flex-1 items-start justify-end gap-2">
        <span className="break-words text-right font-medium text-foreground">{g.value}</span>
        {g.points != null ? (
          <span
            className={cn(
              "w-8 shrink-0 rounded-md px-1 py-0.5 text-center text-[11px] font-semibold tabular-nums",
              g.status === "correct"
                ? "bg-accent text-accent-foreground"
                : g.status === "partial"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {g.points}p
          </span>
        ) : null}
      </span>
    </div>
  )
}

function GuessPanel({ guesses, correct }: { guesses: Guess[]; correct: string | null }) {
  return (
    <div className="mb-2 mt-1 rounded-lg bg-secondary/30 p-2">
      <p className="mb-2 px-1 text-[11px] text-muted-foreground">
        {correct ? (
          <>
            Fasit: <span className="font-medium text-foreground">{correct}</span>
          </>
        ) : (
          "Ikke avgjort ennå"
        )}
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {guesses.map((g) => (
          <GuessCell key={g.name} g={g} />
        ))}
      </div>
    </div>
  )
}

// A question row that expands to reveal every contestant's answer.
function ExpandableRow({
  label,
  line,
  correct,
  guesses,
  panel,
  children,
}: {
  label: string
  line?: AnswerLine
  correct: string | null
  guesses?: Guess[]
  // Custom expanded content; falls back to the standard per-contestant guess grid.
  panel?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 py-2 text-left"
      >
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-right text-sm">
          {children}
          <PointsBadge line={line} />
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? panel ?? <GuessPanel guesses={guesses ?? []} correct={correct} /> : null}
    </div>
  )
}

function SectionCard({
  title,
  icon,
  lines,
  children,
}: {
  title: string
  icon?: React.ReactNode
  lines?: AnswerLine[]
  children: React.ReactNode
}) {
  const earned = lines ? lines.reduce((s, l) => s + l.points, 0) : null
  const max = lines ? lines.reduce((s, l) => s + l.max, 0) : null
  const remaining = lines
    ? lines.filter((l) => l.status === "pending").reduce((s, l) => s + l.max - (l.forfeited ?? 0), 0)
    : 0
  const pct = max ? Math.round((earned! / max) * 100) : 0
  const ceilPct = max ? Math.round(((earned! + remaining) / max) * 100) : 0
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {title}
        </h3>
        {earned != null ? (
          <span className="flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums">
            <span className="font-semibold text-foreground">
              {earned} / {max}
            </span>
            {remaining > 0 ? <span className="font-medium text-primary/70">+{remaining} mulig</span> : null}
          </span>
        ) : null}
      </div>
      {earned != null && max ? (
        <div className="mb-2.5 mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="relative h-full w-full">
            <div className="bar-grow absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ ["--bar-w" as string]: `${ceilPct}%` }} />
            <div className="bar-grow absolute inset-y-0 left-0 rounded-full bg-primary" style={{ ["--bar-w" as string]: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

export function ContestantDetail({
  contestant,
  score,
  contestants,
  standings,
  matches,
  groupQuestions,
  results,
  phases,
  history,
  rank,
  onBack,
}: {
  contestant: Contestant
  score: ScoreBreakdown
  contestants: Contestant[]
  standings: ScoreBreakdown[]
  matches: Match[]
  groupQuestions: GroupQuestion[]
  results: Record<string, MatchResult>
  phases: Record<string, MatchPhase>
  history: StandingsHistoryData
  rank: number
  onBack: () => void
}) {
  const c = contestant
  const b = score.bonus
  const matchMax = score.matches.length * 2
  const perfect = perfectTotal(score)
  const earnedPct = perfect ? (score.total / perfect) * 100 : 0
  const ceilPct = perfect ? (score.maxPoints / perfect) * 100 : 0
  const rankIcon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null

  // Look up every contestant in standings order (best first) with its breakdown.
  const everyone = standings
    .map((bd) => ({ bd, person: contestants.find((x) => x.name === bd.name) }))
    .filter((e): e is { bd: ScoreBreakdown; person: Contestant } => !!e.person)

  // Everyone's predicted scoreline for one group match.
  function matchGuesses(matchId: string): Guess[] {
    return everyone.map(({ bd, person }) => {
      const pm = person.groupMatches.find((g) => g.id === matchId)
      const value = pm && pm.home != null && pm.away != null ? `${pm.home}–${pm.away}` : "-"
      const mb = bd.matches.find((x) => x.id === matchId)
      let points: number | null = null
      let status: AnswerStatus | null = null
      if (mb?.settled) {
        points = mb.points
        status = mb.exactHit ? "correct" : mb.outcomeHit ? "partial" : "wrong"
      }
      return { name: person.name, value, points, status, selected: person.name === c.name }
    })
  }

  // Everyone's answer for one bonus question (group questions / Norway / knockout / final).
  function bonusGuesses(group: BonusGroup, key: string, extract: (p: Contestant) => string): Guess[] {
    return everyone.map(({ bd, person }) => {
      const line = bd.bonus[group][key]
      const status = line?.status ?? null
      const points = line && line.status !== "pending" ? line.points : null
      return { name: person.name, value: extract(person) || "-", points, status, selected: person.name === c.name }
    })
  }

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
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-sky-700 p-4 text-primary-foreground shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
              {rankIcon ? <span aria-hidden="true">{rankIcon}</span> : null}
              Plassering #{rank}
            </p>
            <h2 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight">{c.name}</h2>
            <p className="mt-1 text-xs text-primary-foreground/75">
              {score.matchPoints} fra kamper · {score.bonusPoints} fra spørsmål
            </p>
          </div>
          <div className="flex shrink-0 gap-4 text-center">
            <div>
              <div className="text-3xl font-extrabold tabular-nums leading-none">{score.total}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-primary-foreground/70">
                av {perfect} p
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-3xl font-extrabold tabular-nums leading-none">
                {score.exactPoints}
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-primary-foreground/70">blink</div>
            </div>
          </div>
        </div>

        {/* Earned vs. still-possible toward a perfect card. */}
        <div className="mt-3.5">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/20">
            <div className="bar-grow absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ ["--bar-w" as string]: `${ceilPct}%` }} />
            <div className="bar-grow absolute inset-y-0 left-0 rounded-full bg-accent" style={{ ["--bar-w" as string]: `${earnedPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-medium text-primary-foreground/80">
            <span>{score.total} sikret</span>
            <span>{score.remainingPoints > 0 ? `tak ${score.maxPoints} · +${score.remainingPoints} mulig` : "alt avgjort"}</span>
          </div>
        </div>
      </div>

      {/* This contestant's points over time, highlighted against the field. */}
      <div className="mb-4">
        <StandingsHistory
          series={history.series}
          start={history.start}
          end={history.end}
          now={history.now}
          focusName={c.name}
        />
      </div>

      <p className="mb-3 px-1 text-xs text-muted-foreground">Trykk på et spørsmål for å se hva alle har tippet.</p>

      <div className="grid grid-cols-1 gap-3">
        {/* Group matches */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="text-muted-foreground">⚽</span>
              Gruppespillskamper
            </h3>
            <span className="flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums">
              <span className="font-semibold text-foreground">
                {score.matchPoints} / {matchMax}
              </span>
              {(() => {
                const left = score.matches.filter((x) => x.open).length * 2
                return left > 0 ? <span className="font-medium text-primary/70">+{left} mulig</span> : null
              })()}
            </span>
          </div>
          <div className="divide-y divide-border">
            {matches.map((m) => {
              const pm = c.groupMatches.find((g) => g.id === m.id)
              const r = results[m.id]
              const phase = phases[m.id] ?? "upcoming"
              const settled = phase === "finished" && r?.home != null && r?.away != null
              const mb = score.matches.find((x) => x.id === m.id)
              return (
                <MatchRow
                  key={m.id}
                  guesses={matchGuesses(m.id)}
                  correct={settled ? `${r!.home}–${r!.away}` : null}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-bold text-secondary-foreground">
                    {m.group}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                    <span className="truncate">{m.home}</span>
                    <Flag team={m.home} className="h-3 w-4" />
                  </span>
                  <span className="shrink-0 rounded bg-secondary/50 px-1.5 py-0.5 font-semibold tabular-nums">
                    {pm && pm.home != null ? `${pm.home}–${pm.away}` : "-"}
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
                              mb.exactHit ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary",
                            )}
                          >
                            +{mb.points}
                          </span>
                        ) : (
                          <X className="size-3.5 text-muted-foreground" />
                        )}
                      </span>
                    ) : phase === "live" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                        <span className="animate-live inline-flex size-1.5 rounded-full bg-primary" />
                        spilles nå
                      </span>
                    ) : phase === "awaiting" ? (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">henter resultat</span>
                    ) : (
                      <span className="text-[10px] font-medium text-primary/60">+2 mulig</span>
                    )}
                  </span>
                </MatchRow>
              )
            })}
          </div>
        </div>

        <SectionCard title="Grupper (2 poeng per rett)" icon={<LayoutGrid className="size-4" />} lines={Object.values(b.groupQuestions)}>
          {groupQuestions.map((q) => (
            <ExpandableRow
              key={q.key}
              label={q.text}
              line={b.groupQuestions[q.key]}
              correct={b.groupQuestions[q.key]?.correct ?? null}
              guesses={bonusGuesses("groupQuestions", q.key, (p) => jn(p.groupQuestions[q.key]))}
            >
              <span className="font-medium text-foreground">{c.groupQuestions[q.key] || "-"}</span>
            </ExpandableRow>
          ))}
        </SectionCard>

        <SectionCard title="Norge (2 poeng per rett)" icon={<Flag team="Norge" className="h-3 w-4" />} lines={Object.values(b.norway)}>
          <ExpandableRow
            label="Scorer Norge 7+ mål i gruppespillet?"
            line={b.norway.score7plus}
            correct={b.norway.score7plus.correct}
            guesses={bonusGuesses("norway", "score7plus", (p) => jn(p.norway.score7plus))}
          >
            <span className="font-medium text-foreground">{jn(c.norway.score7plus)}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Slipper Norge inn 4+ mål i gruppespillet?"
            line={b.norway.concede4plus}
            correct={b.norway.concede4plus.correct}
            guesses={bonusGuesses("norway", "concede4plus", (p) => jn(p.norway.concede4plus))}
          >
            <span className="font-medium text-foreground">{jn(c.norway.concede4plus)}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Møter Norge Brasil i finalespillet?"
            line={b.norway.meetBrazil}
            correct={b.norway.meetBrazil.correct}
            guesses={bonusGuesses("norway", "meetBrazil", (p) => jn(p.norway.meetBrazil))}
          >
            <span className="font-medium text-foreground">{jn(c.norway.meetBrazil)}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Hvem når lengst av Norge og England?"
            line={b.norway.furthest}
            correct={b.norway.furthest.correct}
            guesses={bonusGuesses("norway", "furthest", (p) => p.norway.furthest)}
          >
            <span className="font-medium text-foreground">{c.norway.furthest || "-"}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Norges toppscorer"
            line={b.norway.topScorer}
            correct={b.norway.topScorer.correct}
            guesses={bonusGuesses("norway", "topScorer", (p) => p.norway.topScorer)}
          >
            <span className="font-medium text-foreground">{c.norway.topScorer || "-"}</span>
          </ExpandableRow>
        </SectionCard>

        <SectionCard title="Sluttspillet (2 poeng per rett)" icon={<Swords className="size-4" />} lines={Object.values(b.knockout)}>
          <ExpandableRow
            label="Går Sverige videre fra gruppespillet?"
            line={b.knockout.swedenAdvances}
            correct={b.knockout.swedenAdvances.correct}
            guesses={bonusGuesses("knockout", "swedenAdvances", (p) => jn(p.knockout.swedenAdvances))}
          >
            <span className="font-medium text-foreground">{jn(c.knockout.swedenAdvances)}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Antall europeiske lag til sekstendedelsfinale"
            line={b.knockout.europeanTeams}
            correct={b.knockout.europeanTeams.correct}
            guesses={bonusGuesses("knockout", "europeanTeams", (p) => p.knockout.europeanTeams)}
          >
            <span className="font-medium text-foreground">{c.knockout.europeanTeams || "-"}</span>
          </ExpandableRow>
          <ExpandableRow
            label="Vertsnasjon(er) videre til åttendedelsfinale"
            line={b.knockout.hostsAdvance}
            correct={b.knockout.hostsAdvance.correct}
            guesses={bonusGuesses("knockout", "hostsAdvance", (p) => p.knockout.hostsAdvance)}
          >
            <span className="font-medium text-foreground">{c.knockout.hostsAdvance || "-"}</span>
          </ExpandableRow>
          <ExpandableRow
            label="8 land til kvartfinale (2 poeng per rett)"
            line={b.knockout.quarterfinalists}
            correct={b.knockout.quarterfinalists.correct}
            panel={
              <QuarterfinalistsMatrix
                everyone={everyone}
                focusName={c.name}
                line={b.knockout.quarterfinalists}
              />
            }
          >
            <span className="font-medium text-foreground">{c.knockout.quarterfinalists.length || "-"} lag</span>
          </ExpandableRow>
          {b.knockout.quarterfinalists.chips?.length ? (
            <div className="flex flex-wrap gap-1.5 py-2">
              {b.knockout.quarterfinalists.chips.map((chip, i) => (
                <span
                  key={`${chip.value}-${i}`}
                  title={chip.dead && !chip.hit ? `${chip.value} er slått ut` : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    chip.hit
                      ? "bg-accent text-accent-foreground"
                      : chip.dead
                        ? "bg-muted text-muted-foreground line-through decoration-muted-foreground/60"
                        : "bg-secondary text-secondary-foreground",
                  )}
                >
                  <Flag team={chip.value} className={cn("h-3 w-4", chip.dead && !chip.hit && "opacity-40 grayscale")} />
                  {chip.value}
                </span>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Finalen" icon={<Medal className="size-4" />} lines={Object.values(b.final)}>
          <ExpandableRow
            label="Finalelag (4 poeng, 2 for ett rett)"
            line={b.final.teams}
            correct={b.final.teams.correct}
            guesses={bonusGuesses("final", "teams", (p) => `${p.final.team1 || "?"} – ${p.final.team2 || "?"}`)}
          >
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Flag team={c.final.team1} className="h-3 w-4" />
                {c.final.team1 || "-"}
              </span>
              <span className="text-muted-foreground">vs</span>
              <span className="inline-flex items-center gap-1.5">
                <Flag team={c.final.team2} className="h-3 w-4" />
                {c.final.team2 || "-"}
              </span>
            </span>
          </ExpandableRow>
          <ExpandableRow
            label="Målscore etter 90 min (3 poeng)"
            line={b.final.score}
            correct={b.final.score.correct}
            guesses={bonusGuesses("final", "score", (p) =>
              p.final.score1 != null ? `${p.final.score1}–${p.final.score2}` : "-",
            )}
          >
            <span className="font-medium tabular-nums text-foreground">
              {c.final.score1 != null ? `${c.final.score1}–${c.final.score2}` : "-"}
            </span>
          </ExpandableRow>
          <ExpandableRow
            label="Verdensmester (5 poeng)"
            line={b.final.champion}
            correct={b.final.champion.correct}
            guesses={bonusGuesses("final", "champion", (p) => p.final.champion)}
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Flag team={c.final.champion} className="h-3 w-4" />
              {c.final.champion || "-"}
            </span>
          </ExpandableRow>
          <ExpandableRow
            label="VMs toppscorer fra land (3 poeng)"
            line={b.final.topScorerCountry}
            correct={b.final.topScorerCountry.correct}
            guesses={bonusGuesses("final", "topScorerCountry", (p) => p.final.topScorerCountry)}
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Flag team={c.final.topScorerCountry} className="h-3 w-4" />
              {c.final.topScorerCountry || "-"}
            </span>
          </ExpandableRow>
        </SectionCard>
      </div>
    </section>
  )
}

// Side-by-side comparison of everyone's 8 quarterfinalist picks.
// Countries are columns (most-picked first, so consensus sits left and the
// differentiators fall to the right); contestants are rows.
function QuarterfinalistsMatrix({
  everyone,
  focusName,
  line,
}: {
  everyone: { bd: ScoreBreakdown; person: Contestant }[]
  focusName: string
  line: AnswerLine
}) {
  const decided = line.status !== "pending" && !!line.correct
  const correctSet = new Set(
    decided ? line.correct!.split(",").map((s) => s.trim()).filter(Boolean) : [],
  )

  // Teams already knocked out: a pick on one is wrong even before the full
  // quarterfinal lineup is settled. Normalized so lookups are case-insensitive.
  const deadSet = new Set((line.eliminated ?? []).map((t) => t.trim().toLowerCase()))
  const isDead = (t: string) => deadSet.has(t.trim().toLowerCase())

  // Popularity per country, plus any qualified team that nobody picked.
  const counts = new Map<string, number>()
  for (const { person } of everyone) {
    for (const t of person.knockout.quarterfinalists) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  for (const t of correctSet) if (!counts.has(t)) counts.set(t, 0)
  const columns = [...counts.keys()].sort(
    (a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b, "nb"),
  )
  const anyDead = columns.some(isDead)

  const focusPicks = new Set(
    everyone.find((e) => e.person.name === focusName)?.person.knockout.quarterfinalists ?? [],
  )

  const rows = everyone.map(({ bd, person }) => {
    const picks = new Set(person.knockout.quarterfinalists)
    const qf = bd.bonus.knockout.quarterfinalists
    return {
      name: person.name,
      focused: person.name === focusName,
      picks,
      hits: qf.chips?.filter((ch) => ch.hit).length ?? 0,
      points: qf.points,
      // Picks already eliminated — shown as a running "slått ut" count while pending.
      dead: [...picks].filter((t) => isDead(t)).length,
      shared: [...picks].filter((t) => focusPicks.has(t)).length,
    }
  })

  if (columns.length === 0) {
    return <p className="px-1 py-3 text-xs text-muted-foreground">Ingen tips registrert ennå.</p>
  }

  return (
    <div className="mb-2 mt-1 rounded-lg bg-secondary/30 p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <p className="text-[11px] text-muted-foreground">
          Hver kolonne er et land — tallet viser hvor mange som tippet det. Mest populære først.
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {decided ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Check className="size-3 text-accent" /> rett
              </span>
              <span className="inline-flex items-center gap-1">
                <X className="size-3 text-muted-foreground/70" /> bom
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary/70" /> tippet
              </span>
              {anyDead ? (
                <span className="inline-flex items-center gap-1">
                  <X className="size-3 text-muted-foreground/70" /> slått ut
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-card px-2 pb-1.5 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Deltaker
              </th>
              <th
                scope="col"
                title={`Felles med ${focusName}`}
                className="px-1.5 pb-1.5 text-center align-bottom text-[10px] font-medium text-muted-foreground"
              >
                Felles
              </th>
              {columns.map((t) => {
                const qualified = decided && correctSet.has(t)
                // Greyed out once knocked out, or (when fully decided) didn't reach the QF.
                const eliminated = !qualified && (isDead(t) || decided)
                return (
                  <th key={t} scope="col" className="px-0 pb-1.5 align-bottom">
                    <div className="flex flex-col items-center gap-1">
                      <Flag
                        team={t}
                        className={cn(
                          "h-3.5 w-5",
                          qualified && "ring-2 ring-accent",
                          eliminated && "opacity-40 grayscale",
                        )}
                      />
                      <span className="sr-only">{t}</span>
                      <span
                        className={cn(
                          "text-[10px] tabular-nums",
                          qualified ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {counts.get(t) ?? 0}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-[8.5rem] truncate bg-card px-2 py-1 text-left text-xs font-medium",
                    r.focused ? "border-l-2 border-accent font-bold text-foreground" : "text-foreground/90",
                  )}
                >
                  <span className="flex items-center gap-1">
                    {r.focused ? <span className="text-accent" aria-hidden="true">★</span> : null}
                    <span className="truncate">{r.name}</span>
                    {decided ? (
                      <span className="ml-auto shrink-0 pl-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {r.points}p
                      </span>
                    ) : r.dead > 0 ? (
                      <span
                        className="ml-auto shrink-0 pl-1 text-[10px] font-medium tabular-nums text-muted-foreground"
                        title={`${r.dead} av tipsene er slått ut`}
                      >
                        −{r.dead}
                      </span>
                    ) : null}
                  </span>
                </th>
                <td
                  className={cn(
                    "px-1.5 py-1 text-center text-xs tabular-nums",
                    r.focused && "bg-primary/[0.06]",
                  )}
                >
                  {r.focused ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="font-semibold text-foreground">{r.shared}</span>
                  )}
                </td>
                {columns.map((t) => {
                  const picked = r.picks.has(t)
                  const hit = picked && decided && correctSet.has(t)
                  // A pick is a known miss if its team is out, or the lineup is settled
                  // and the team isn't in it.
                  const miss = picked && !hit && (isDead(t) || decided)
                  return (
                    <td
                      key={t}
                      className={cn(
                        "border-l border-border/40 px-1 py-1 text-center",
                        hit && "bg-accent/10",
                        r.focused && !hit && "bg-primary/[0.06]",
                      )}
                    >
                      {!picked ? (
                        <span className="sr-only">nei</span>
                      ) : hit ? (
                        <Check className="mx-auto size-3.5 text-accent" />
                      ) : miss ? (
                        <X className="mx-auto size-3 text-muted-foreground/60" />
                      ) : (
                        <span className="mx-auto block size-2.5 rounded-full bg-primary/70" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// A group-match row: rich header (flags + result) that expands to everyone's tips.
function MatchRow({
  guesses,
  correct,
  children,
}: {
  guesses: Guess[]
  correct: string | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm"
      >
        {children}
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <GuessPanel guesses={guesses} correct={correct} /> : null}
    </div>
  )
}
