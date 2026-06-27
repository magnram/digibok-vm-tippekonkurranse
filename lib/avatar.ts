// Stable per-person colours, shared by the standings avatars and the history
// graph so a contestant has the same identity colour everywhere.
const PALETTE = [
  { tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", line: "#10b981" },
  { tint: "bg-sky-500/15 text-sky-700 dark:text-sky-300", line: "#0ea5e9" },
  { tint: "bg-amber-500/15 text-amber-700 dark:text-amber-300", line: "#f59e0b" },
  { tint: "bg-violet-500/15 text-violet-700 dark:text-violet-300", line: "#8b5cf6" },
  { tint: "bg-rose-500/15 text-rose-700 dark:text-rose-300", line: "#f43f5e" },
  { tint: "bg-teal-500/15 text-teal-700 dark:text-teal-300", line: "#14b8a6" },
  { tint: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", line: "#d946ef" },
  { tint: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", line: "#06b6d4" },
]

function indexFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return h % PALETTE.length
}

export function avatarTint(name: string): string {
  return PALETTE[indexFor(name)].tint
}

export function lineColor(name: string): string {
  return PALETTE[indexFor(name)].line
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
