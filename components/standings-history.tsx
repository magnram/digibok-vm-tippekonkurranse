"use client"

import { useRef, useState } from "react"
import type { HistoryPoint, HistorySeries } from "@/lib/history"
import { lineColor } from "@/lib/avatar"
import { cn } from "@/lib/utils"

// Geometry of the SVG canvas (viewBox units; scales responsively).
const W = 820
const H = 340
const PAD = { t: 16, r: 16, b: 34, l: 32 }

function niceMax(v: number): number {
  if (v <= 5) return 5
  return Math.ceil(v / 5) * 5
}

const DATE_FMT = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", timeZone: "Europe/Oslo" })
// Date + time of day, used for the scrub tooltip.
const DATE_TIME_FMT = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
})

// Vertical reference lines for the key tournament moments.
function milestones(start: number, end: number) {
  return [
    { t: Date.UTC(2026, 5, 27, 21, 0), label: "Gruppespill slutt" },
    { t: Date.UTC(2026, 6, 7, 21, 0), label: "8-delsfinaler" },
    { t: Date.UTC(2026, 6, 19, 21, 0), label: "Finale" },
  ].filter((m) => m.t >= start && m.t <= end)
}

// Cumulative points for a contestant at instant t (step function lookup).
function valueAt(points: HistoryPoint[], t: number): number {
  let v = 0
  for (const p of points) {
    if (p.t <= t) v = p.p
    else break
  }
  return v
}

export function StandingsHistory({
  series,
  start,
  end,
  now,
  focusName = null,
}: {
  series: HistorySeries[]
  start: number
  end: number
  now: number
  focusName?: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const [cursorT, setCursorT] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const maxTotal = Math.max(0, ...series.map((s) => s.total))
  if (maxTotal === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <h3 className="text-sm font-bold text-foreground">Stillingsutvikling</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Grafen våkner til liv så snart de første poengene er i boks. Her kan alt skje! ⚽
        </p>
      </div>
    )
  }

  const maxY = niceMax(maxTotal)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const span = Math.max(1, end - start)
  const lastT = Math.min(now, end)

  const x = (t: number) => PAD.l + ((t - start) / span) * innerW
  const y = (p: number) => PAD.t + innerH - (p / maxY) * innerH

  // Build a step path: flat between events, vertical jump at each event, then
  // extend flat to "now".
  function path(s: HistorySeries): string {
    let d = `M ${x(start)} ${y(0)}`
    let prev = 0
    for (const pt of s.points) {
      d += ` L ${x(pt.t)} ${y(prev)} L ${x(pt.t)} ${y(pt.p)}`
      prev = pt.p
    }
    d += ` L ${x(lastT)} ${y(prev)}`
    return d
  }

  const active = hover ?? focusName

  // Draw order: active line on top, otherwise lowest totals first.
  const ordered = [...series].sort((a, b) => {
    const aw = a.name === active ? 2 : 0
    const bw = b.name === active ? 2 : 0
    return aw - bw || a.total - b.total
  })

  const yTicks = [0, Math.round(maxY / 2), maxY]
  const ms = milestones(start, end)

  // Pointer scrubbing → snap to a moment in time and read out the standings there.
  function moveTo(clientX: number) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const vbX = ((clientX - rect.left) / rect.width) * W
    const clamped = Math.min(PAD.l + innerW, Math.max(PAD.l, vbX))
    const t = start + ((clamped - PAD.l) / innerW) * span
    setCursorT(Math.min(lastT, Math.max(start, t)))
  }

  // Standings at the scrubbed instant (for the tooltip).
  const atCursor =
    cursorT == null
      ? []
      : series
          .map((s) => ({ name: s.name, v: valueAt(s.points, cursorT) }))
          .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name, "nb"))
  const topAtCursor = atCursor.slice(0, 5)
  const cursorLeftPct = cursorT == null ? 0 : Math.min(86, Math.max(14, (x(cursorT) / W) * 100))

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold tracking-tight text-foreground">Stillingsutvikling</h3>
        <span className="text-xs text-muted-foreground">
          {cursorT != null ? DATE_TIME_FMT.format(new Date(cursorT)) : "poeng gjennom mesterskapet"}
        </span>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair touch-pan-y"
          role="img"
          aria-label="Graf over poeng over tid"
          onMouseMove={(e) => moveTo(e.clientX)}
          onMouseLeave={() => setCursorT(null)}
          onTouchStart={(e) => moveTo(e.touches[0].clientX)}
          onTouchMove={(e) => moveTo(e.touches[0].clientX)}
          onTouchEnd={() => setCursorT(null)}
        >
          {/* horizontal gridlines + y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {t}
              </text>
            </g>
          ))}

          {/* milestone verticals */}
          {ms.map((m) => (
            <g key={m.label}>
              <line
                x1={x(m.t)}
                x2={x(m.t)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={x(m.t)} y={H - PAD.b + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {m.label}
              </text>
            </g>
          ))}

          {/* x range labels */}
          <text x={PAD.l} y={H - PAD.b + 14} textAnchor="start" className="fill-muted-foreground text-[9px]">
            {DATE_FMT.format(new Date(start))}
          </text>

          {/* "now" marker */}
          {now > start && now < end ? (
            <g>
              <line
                x1={x(now)}
                x2={x(now)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                className="stroke-primary/50"
                strokeWidth={1.5}
              />
              <text x={x(now)} y={PAD.t - 4} textAnchor="middle" className="fill-primary text-[9px] font-semibold">
                nå
              </text>
            </g>
          ) : null}

          {/* lines */}
          {ordered.map((s) => {
            const isActive = s.name === active
            const dim = active != null && !isActive
            const last = s.points[s.points.length - 1]
            return (
              <g key={s.name}>
                <path
                  d={path(s)}
                  fill="none"
                  stroke={lineColor(s.name)}
                  strokeWidth={isActive ? 3.5 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dim ? 0.18 : 1}
                />
                {isActive && last ? <circle cx={x(lastT)} cy={y(last.p)} r={4} fill={lineColor(s.name)} /> : null}
              </g>
            )
          })}

          {/* scrub crosshair + dots at the snapped instant */}
          {cursorT != null ? (
            <g>
              <line
                x1={x(cursorT)}
                x2={x(cursorT)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                className="stroke-foreground/30"
                strokeWidth={1}
              />
              {topAtCursor.map((d) => (
                <circle key={d.name} cx={x(cursorT)} cy={y(d.v)} r={3} fill={lineColor(d.name)} />
              ))}
            </g>
          ) : null}
        </svg>

        {/* tooltip: standings at the scrubbed time of day */}
        {cursorT != null ? (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-popover-foreground shadow-lg backdrop-blur-sm"
            style={{ left: `${cursorLeftPct}%` }}
          >
            <div className="mb-1 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
              {DATE_TIME_FMT.format(new Date(cursorT))}
            </div>
            <ul className="space-y-0.5">
              {topAtCursor.map((d, i) => (
                <li
                  key={d.name}
                  className={cn(
                    "flex items-center justify-between gap-3 whitespace-nowrap text-[11px]",
                    d.name === active ? "font-bold text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 text-right tabular-nums opacity-60">{i + 1}.</span>
                    <span className="size-2 rounded-full" style={{ backgroundColor: lineColor(d.name) }} />
                    {d.name}
                  </span>
                  <span className="tabular-nums">{d.v} p</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* interactive legend */}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {[...series]
          .sort((a, b) => b.total - a.total)
          .map((s) => {
            const isActive = s.name === active
            return (
              <li key={s.name}>
                <button
                  type="button"
                  onMouseEnter={() => setHover(s.name)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(s.name)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] transition-colors",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: lineColor(s.name) }} />
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums opacity-70">{s.total}</span>
                </button>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
