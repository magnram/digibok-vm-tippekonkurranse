import { Trophy, Radio, CircleDashed } from "lucide-react"

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
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
  contestantCount,
  leader,
}: {
  source: "api" | "none"
  fetchedAt: string
  note?: string
  settledCount: number
  totalMatches: number
  contestantCount: number
  leader?: string
}) {
  const live = source === "api"
  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Trophy className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/70">
                Kartverket
              </p>
              <h1 className="text-balance text-xl font-bold leading-tight md:text-2xl">
                VM-tipping 2026
              </h1>
            </div>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium"
            title={note ?? (live ? "Live resultater fra football-data.org" : undefined)}
          >
            {live ? (
              <>
                <Radio className="size-3.5 text-accent" aria-hidden="true" />
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

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Deltakere" value={String(contestantCount)} />
          <Stat label="Kamper spilt" value={`${settledCount} / ${totalMatches}`} />
          <Stat label="Leder" value={leader ?? "—"} />
          <Stat label="Oppdatert" value={formatTime(fetchedAt) || "—"} />
        </dl>

        {note ? (
          <p className="mt-4 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs text-primary-foreground/80">
            {note}
          </p>
        ) : null}
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-foreground/10 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/60">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  )
}
