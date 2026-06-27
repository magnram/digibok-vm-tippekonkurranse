"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Crown, Lock, Sparkles } from "lucide-react"
import type { ScoreBreakdown } from "@/lib/types"
import type { StandingsHistoryData } from "@/lib/history"
import { perfectTotal } from "@/lib/scoring"
import { avatarTint, initials } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import { AboutContest } from "@/components/about-contest"
import { StandingsHistory } from "@/components/standings-history"

// Counts a number up from 0 once on mount; respects reduced-motion.
function useCountUp(target: number, duration = 850) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target)
      return
    }
    if (target <= 0) {
      setValue(0)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        avatarTint(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

// The two-layer progress bar: a faint "ceiling" (everything still reachable)
// behind a solid "locked-in" fill.
function ScoreBar({ earned, ceiling, scale, tone = "primary" }: { earned: number; ceiling: number; scale: number; tone?: "primary" | "gold" }) {
  const e = `${Math.min(100, (earned / scale) * 100)}%`
  const c = `${Math.min(100, (ceiling / scale) * 100)}%`
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("bar-grow absolute inset-y-0 left-0 rounded-full", tone === "gold" ? "bg-accent/30" : "bg-primary/25")}
        style={{ ["--bar-w" as string]: c }}
      />
      <div
        className={cn("bar-grow absolute inset-y-0 left-0 rounded-full", tone === "gold" ? "bg-accent" : "bg-primary")}
        style={{ ["--bar-w" as string]: e }}
      />
    </div>
  )
}

const MEDALS = [
  { ring: "ring-accent/60", badge: "bg-accent text-accent-foreground", label: "1." },
  { ring: "ring-slate-400/50", badge: "bg-slate-300 text-slate-800", label: "2." },
  { ring: "ring-amber-700/40", badge: "bg-amber-700 text-amber-50", label: "3." },
]

function PodiumCard({
  s,
  rank,
  scale,
  secured,
  leaderTotal,
  onSelect,
}: {
  s: ScoreBreakdown
  rank: number
  scale: number
  secured: boolean
  leaderTotal: number
  onSelect: (name: string) => void
}) {
  const total = useCountUp(s.total)
  const medal = MEDALS[rank - 1]
  const isGold = rank === 1
  const behind = leaderTotal - s.total

  return (
    <button
      type="button"
      onClick={() => onSelect(s.name)}
      style={{ animationDelay: `${rank * 70}ms` }}
      className={cn(
        "group cursor-football relative flex flex-col items-center overflow-hidden rounded-2xl border px-3 pb-4 pt-5 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        "animate-in fade-in zoom-in-95 fill-mode-both",
        isGold
          ? "animate-sheen border-accent/50 bg-gradient-to-b from-accent/20 to-card shadow-md sm:order-2 sm:-mt-3"
          : rank === 2
            ? "border-border bg-card sm:order-1 sm:mt-2"
            : "border-border bg-card sm:order-3 sm:mt-2",
      )}
    >
      <span
        className={cn(
          "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums shadow-sm",
          medal.badge,
        )}
      >
        {rank}
      </span>

      <div className="relative">
        <Avatar name={s.name} className={cn("size-14 text-lg ring-2", medal.ring, isGold && "size-16 text-xl")} />
        {isGold ? (
          <Crown className="absolute -top-3 left-1/2 size-6 -translate-x-1/2 text-accent drop-shadow" aria-label="Leder" />
        ) : null}
      </div>

      <span className="mt-2.5 max-w-full truncate text-sm font-semibold text-foreground">{s.name}</span>

      <span className="mt-1 flex items-baseline gap-1">
        <span className={cn("font-extrabold tabular-nums text-foreground", isGold ? "text-3xl" : "text-2xl")}>
          {total}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">p</span>
      </span>

      <div className="mt-2.5 w-full">
        <ScoreBar earned={s.total} ceiling={s.maxPoints} scale={scale} tone={isGold ? "gold" : "primary"} />
      </div>

      <div className="mt-2 flex min-h-5 flex-wrap items-center justify-center gap-1.5">
        {isGold && secured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground ring-1 ring-inset ring-accent/40">
            <Lock className="size-3" /> Sikret seier
          </span>
        ) : behind > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">−{behind} p bak</span>
        ) : null}
        {s.remainingPoints > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-primary/70">+{s.remainingPoints} mulig</span>
        ) : null}
      </div>
    </button>
  )
}

function StandingRow({
  s,
  rank,
  scale,
  leaderTotal,
  onSelect,
}: {
  s: ScoreBreakdown
  rank: number
  scale: number
  leaderTotal: number
  onSelect: (name: string) => void
}) {
  const behind = leaderTotal - s.total
  const outOfRace = s.maxPoints < leaderTotal // can't even reach the leader's locked score

  return (
    <li style={{ animationDelay: `${Math.min(rank, 12) * 35}ms` }} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
      <button
        type="button"
        onClick={() => onSelect(s.name)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm",
          outOfRace && "opacity-70",
        )}
      >
        <span className="flex w-6 shrink-0 justify-center text-sm font-bold tabular-nums text-muted-foreground">
          {rank}
        </span>

        <Avatar name={s.name} className="size-9 text-xs" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{s.name}</span>
            {s.exactPoints > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-accent-foreground/80">
                <Sparkles className="size-3 text-accent" />
                {s.exactPoints}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5">
            <ScoreBar earned={s.total} ceiling={s.maxPoints} scale={scale} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums text-foreground">{s.total}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">p</span>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {behind > 0 ? `−${behind}` : "leder"}
            {s.remainingPoints > 0 ? <span className="text-primary/70"> · +{s.remainingPoints}</span> : null}
          </span>
        </div>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  )
}

export function StandingsTable({
  standings,
  history,
  onSelect,
}: {
  standings: ScoreBreakdown[]
  history: StandingsHistoryData
  onSelect: (name: string) => void
}) {
  if (standings.length === 0) return null

  const perfect = perfectTotal(standings[0]) || 1
  // Scale bars to the highest ceiling on the board (so the most-potential player's
  // ghost bar reaches the end), but never below half the perfect card to keep early
  // bars readable.
  const scale = Math.max(perfect * 0.5, ...standings.map((s) => s.maxPoints), 1)

  const leader = standings[0]
  const runnerUp = standings[1]
  const leaderSecured = leader.total > 0 && (!runnerUp || leader.total > runnerUp.maxPoints)

  const podium = standings.slice(0, 3)
  const rest = standings.slice(3)

  return (
    <section aria-label="Stilling">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-base font-bold text-foreground">Sammenlagt stilling</h2>
      </div>

      {/* Podium - top three */}
      {podium.length >= 3 ? (
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:items-end">
          {podium.map((s, i) => (
            <PodiumCard
              key={s.name}
              s={s}
              rank={i + 1}
              scale={scale}
              secured={leaderSecured}
              leaderTotal={leader.total}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      {/* The chasing pack */}
      <ol className="flex flex-col gap-2">
        {(podium.length >= 3 ? rest : standings).map((s, i) => (
          <StandingRow
            key={s.name}
            s={s}
            rank={(podium.length >= 3 ? 3 : 0) + i + 1}
            scale={scale}
            leaderTotal={leader.total}
            onSelect={onSelect}
          />
        ))}
      </ol>


      {/* Legend + scoring summary */}
      <div className="mt-5 space-y-2 px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-primary" /> sikrede poeng
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-primary/25" /> fortsatt mulig
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3 text-accent" /> antall blink (rett sluttresultat)
          </span>
        </div>
      </div>

      {/* Points over time */}
      <div className="mt-6">
        <StandingsHistory
            series={history.series}
            start={history.start}
            end={history.end}
            now={history.now}
        />
      </div>


      <AboutContest />
    </section>
  )
}
