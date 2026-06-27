import { CircleDashed, Crown, Users, CalendarCheck, ListChecks } from "lucide-react"
import { DigiBokMark } from "@/components/digibok-mark"

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Oslo",
    }).format(new Date(iso))
  } catch {
    return ""
  }
}

export function SiteHeader({
  source,
  fetchedAt,
  note,
  settledCount,
  totalMatches,
  decidedQuestions,
  totalQuestions,
  contestantCount,
  leader,
  leaderPoints,
  contestProgress,
}: {
  source: "api" | "none"
  fetchedAt: string
  note?: string
  settledCount: number
  totalMatches: number
  decidedQuestions: number
  totalQuestions: number
  contestantCount: number
  leader?: string
  leaderPoints?: number
  contestProgress: number
}) {
  const live = source === "api"
  const updated = formatTime(fetchedAt)

  return (
    <header className="relative overflow-hidden border-b border-black/10 bg-primary text-primary-foreground">
      {/* Layered backdrop: DigiBok green→blue wash, diagonal sheen, accent glow,
          and a faint pitch dot-grid. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-sky-900/50" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/20" />
      <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 size-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="bg-pitch pointer-events-none absolute inset-0 opacity-[0.18]" />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-7 md:py-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-13 shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-black/25 ring-1 ring-white/30">
              <DigiBokMark className="size-full" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                DigiBok · VM-tippekonkurranse
              </p>
              <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
                VM-tipping <span className="text-accent">2026</span>
              </h1>
              <p className="mt-0.5 text-xs text-primary-foreground/70">
                Arrangert av <span className="font-semibold text-primary-foreground/90">Knut</span>
              </p>
            </div>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/15 backdrop-blur-sm"
            title={note ?? (live ? "Live resultater fra football-data.org" : undefined)}
          >
            {live ? (
              <>
                <span className="animate-live relative inline-flex size-2 rounded-full bg-accent" aria-hidden="true" />
                <span>Live oppdatert</span>
              </>
            ) : (
              <>
                <CircleDashed className="size-3.5" aria-hidden="true" />
                <span>Venter på resultater</span>
              </>
            )}
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={<Users className="size-3.5" />} label="Deltakere" value={String(contestantCount)} />
          <Stat
            icon={<CalendarCheck className="size-3.5" />}
            label="Tippekamper"
            value={`${settledCount} / ${totalMatches}`}
            sub="avgjort"
          />
          <Stat
            icon={<ListChecks className="size-3.5" />}
            label="Spørsmål"
            value={`${decidedQuestions} / ${totalQuestions}`}
            sub="avgjort"
          />
          <Stat
            icon={<Crown className="size-3.5 text-accent" />}
            label="Leder"
            value={leader ?? "-"}
            sub={leader && leaderPoints != null ? `${leaderPoints} p` : undefined}
            highlight
          />
        </dl>

        {/* Overall contest progress: share of all available points now decided. */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-medium text-primary-foreground/75">
            <span>Konkurransen {contestProgress}% avgjort</span>
            {updated ? <span>Oppdatert {updated}</span> : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/15">
            <div
              className="bar-grow h-full rounded-full bg-gradient-to-r from-accent to-accent/70"
              style={{ ["--bar-w" as string]: `${contestProgress}%` }}
            />
          </div>
        </div>

        {note ? (
          <p className="mt-4 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground/80 ring-1 ring-inset ring-white/10">
            {note}
          </p>
        ) : null}
      </div>
    </header>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl bg-primary-foreground/10 px-3 py-2.5 ring-1 ring-inset backdrop-blur-sm ${
        highlight ? "ring-accent/40" : "ring-white/10"
      }`}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary-foreground/60">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        <span className="truncate text-sm font-semibold">{value}</span>
        {sub ? <span className="shrink-0 text-xs font-medium tabular-nums text-accent">{sub}</span> : null}
      </dd>
    </div>
  )
}
