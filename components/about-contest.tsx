import { DigiBokMark } from "@/components/digibok-mark"

// The story behind the contest, drawn from Knut's invitation and his email
// updates - kept free of specific standings numbers since the live table covers that.
export function AboutContest() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
        <DigiBokMark className="size-6 rounded-md" />
        <h2 className="text-sm font-bold tracking-tight text-foreground">Om konkurransen</h2>
      </div>
      <div className="space-y-3 p-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          DigiBoks egen tippekonkurranse for <span className="font-medium text-foreground">fotball-VM 2026</span>,
          arrangert av <span className="font-medium text-foreground">Knut</span> - med noen «eksklusivt utvalgte
          eks-medlemmer» invitert på kopilista. Alle fylte ut hvert sitt excelark før avspark; her er stillingen, nå
          helt live.
        </p>
        <figure className="rounded-xl border-l-2 border-accent bg-accent/10 px-3 py-2">
          <blockquote className="text-pretty font-medium text-foreground">
            «Vinneren vil bli premiert på en eller annen måte 😉»
          </blockquote>
          <figcaption className="mt-1 text-xs text-muted-foreground">- Knut, i invitasjonen</figcaption>
        </figure>
        <p>
          Før kom oppdateringene som e-post fra Knut - helt til han dro på ferie og overlot resten til skjebnen («Her
          kan alt skje!!»). Nå oppdaterer stillingen seg selv, så ingen trenger å vente til midten av juli for å kåre{" "}
          <span className="font-medium text-foreground">tippemesteren</span>.
        </p>
      </div>
    </div>
  )
}
