// One-off admin tool: fetch the current WC snapshot from football-data.org and
// write it straight into the prod api_cache row. Use when prod's own refetch is
// failing (e.g. missing/rate-limited API key in Vercel) and the cached snapshot is
// stale, so the derived fasit won't resolve.
//
// Run:
//   PROD_DATABASE_URL='postgresql://…neon…?sslmode=require' \
//     node --env-file=.env scripts/refresh-prod-cache.mjs
//
// FOOTBALL_DATA_API_KEY is read from .env (via --env-file); PROD_DATABASE_URL is
// passed inline so the secret never lands in a file. Only the id='wc' row is touched.
import { Pool } from "pg"

const KEY = process.env.FOOTBALL_DATA_API_KEY
const URL = process.env.PROD_DATABASE_URL
if (!KEY) throw new Error("FOOTBALL_DATA_API_KEY missing — run with `node --env-file=.env …`")
if (!URL) throw new Error("PROD_DATABASE_URL missing — pass it inline before the command")

const BASE = "https://api.football-data.org/v4/competitions/WC"
const opts = { headers: { "X-Auth-Token": KEY } }

const [mRes, sRes, scRes] = await Promise.all([
  fetch(`${BASE}/matches`, opts),
  fetch(`${BASE}/standings`, opts),
  fetch(`${BASE}/scorers?limit=100`, opts),
])
if (!mRes.ok || !sRes.ok) {
  throw new Error(`football-data fetch failed: matches ${mRes.status}, standings ${sRes.status}`)
}
const matches = (await mRes.json()).matches ?? []
const standings = (await sRes.json()).standings ?? []
const scorers = scRes.ok ? ((await scRes.json()).scorers ?? []) : []

// Sanity: the round of 16 should be fully decided in this data.
const r16 = matches.filter((m) => m.stage === "LAST_16")
const r16Decided = r16.filter((m) => m.score?.winner === "HOME_TEAM" || m.score?.winner === "AWAY_TEAM").length
const finalDone = matches.some((m) => m.stage === "FINAL" && m.status === "FINISHED")

const pool = new Pool({
  connectionString: URL,
  ssl: /localhost|127\.0\.0\.1/.test(URL) ? undefined : { rejectUnauthorized: false },
})
await pool.query(
  `INSERT INTO api_cache (id, payload, frozen, fetched_at)
   VALUES ('wc', $1, $2, now())
   ON CONFLICT (id) DO UPDATE
     SET payload = EXCLUDED.payload, frozen = EXCLUDED.frozen, fetched_at = now()`,
  [JSON.stringify({ matches, standings, scorers }), finalDone],
)
const { rows } = await pool.query(`SELECT fetched_at FROM api_cache WHERE id = 'wc'`)
await pool.end()

console.log(
  `Wrote prod snapshot: ${matches.length} matches, ${standings.length} standings, ${scorers.length} scorers`,
)
console.log(`Round of 16 decided: ${r16Decided}/${r16.length}  |  frozen: ${finalDone}`)
console.log(`api_cache.fetched_at is now: ${rows[0]?.fetched_at?.toISOString?.() ?? rows[0]?.fetched_at}`)
