# kartverket-vm-gjettekonkurranse

Stillingen i Kartverkets VM-tippekonkurranse for fotball-VM 2026 – en [Next.js](https://nextjs.org)-app som henter resultater fra [football-data.org](https://www.football-data.org) og mellomlagrer dem i Postgres.

## Kom i gang

### 1. Miljøvariabler

Hent et API-nøkkel fra [football-data.org](https://www.football-data.org/client/register) og kopier miljøfila:

```bash
cp .env.template .env
# fyll inn FOOTBALL_DATA_API_KEY i .env
```

`DATABASE_URL` er allerede satt til å peke på den lokale Postgres-databasen under.

### 2. Database (Postgres via Docker)

Resultater lagres i Postgres slik at football-data.org-API-et bare kalles når dataene er eldre enn ~5 minutter – ikke på hvert sidevisning.

```bash
npm run db:up      # starter Postgres (docker compose, port 5432)
npm run db:push    # oppretter tabellene (drizzle-kit)
```

Nyttig:

```bash
npm run db:studio  # nettleser-UI for å se på dataene
npm run db:down    # stopper databasen (dataene beholdes i volumet)
```

> Bruker du en egen Postgres (f.eks. Homebrew `postgresql@18`) i stedet for Docker, hopp over `db:up` og pek `DATABASE_URL` mot den. Kjør fortsatt `npm run db:push`.

### 3. Kjør appen

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

Første sidevisning henter fra API-et og fyller cachen; påfølgende visninger leses fra Postgres til cachen blir foreldet. Uten et API-nøkkel kjører appen fortsatt og viser «Venter på resultater». Er databasen utilgjengelig, faller appen tilbake til å kalle API-et direkte.

## Hvordan data flyter

```
football-data.org  ──(maks 1 kall / 5 min)──▶  Postgres (match_results, sync_state)  ──▶  siden
```

- `lib/results.ts` – lese/skrive cache + on-demand-oppdatering.
- `lib/db/schema.ts` – Drizzle-skjema for `match_results` og `sync_state`.
- `lib/match-time.ts` – utleder om en kamp er ferdigspilt ut fra kampstart og status.

## Lær mer

- [Next.js-dokumentasjon](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [football-data.org API](https://www.football-data.org/documentation/quickstart)
