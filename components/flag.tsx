import { TEAMS } from "@/lib/teams"
import { cn } from "@/lib/utils"

export function Flag({
  team,
  className,
}: {
  team: string
  className?: string
}) {
  const code = TEAMS[team]?.code
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] ring-1 ring-border bg-muted",
        className,
      )}
      aria-hidden="true"
    >
      {code ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/${code}.svg`}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-[8px] font-medium text-muted-foreground">?</span>
      )}
    </span>
  )
}

export function TeamLabel({
  team,
  className,
  flagClass = "h-3.5 w-5",
}: {
  team: string
  className?: string
  flagClass?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Flag team={team} className={flagClass} />
      <span className="truncate">{team}</span>
    </span>
  )
}
