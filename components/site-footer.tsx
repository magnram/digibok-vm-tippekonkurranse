import { DigiBokMark } from "@/components/digibok-mark"

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-card/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center">
        <DigiBokMark className="size-14 rounded-xl" />
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Et velfortjent avbrekk fra Grunnboken for DigiBok.
        </p>
        <p className="text-xs text-muted-foreground">
          📖 Alle tips er tinglyst - ingen heftelser, ingen omkamp. Lykke til!
        </p>
      </div>
    </footer>
  )
}
