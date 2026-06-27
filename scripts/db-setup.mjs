// One-off operational script: bring a deployed Postgres in line with the current
// Drizzle schema (lib/db/schema.ts).
//
// It does two things, each gated behind an explicit flag so a bare run is
// read-only:
//   1. Creates the `api_cache` table if missing  (--apply)   — non-destructive
//   2. Drops the orphaned `match_results` / `sync_state`      — DESTRUCTIVE
//      tables left over from the pre-eb71658 caching design   (--drop-orphans)
//
// Usage (run from the project root so `pg` resolves):
//   DATABASE_URL="<prod-url>" node scripts/db-setup.mjs                       # dry-run
//   DATABASE_URL="<prod-url>" node scripts/db-setup.mjs --apply              # create api_cache
//   DATABASE_URL="<prod-url>" node scripts/db-setup.mjs --apply --drop-orphans
//
// Every statement is idempotent; safe to re-run. Not committed — delete when done.

import pg from "pg"

const { Pool } = pg

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Run: DATABASE_URL="<prod-url>" node scripts/db-setup.mjs')
  process.exit(1)
}

const apply = process.argv.includes("--apply")
const dropOrphans = process.argv.includes("--drop-orphans")

// Mirror the app's TLS logic (Neon & other managed Postgres require it; local docker does not).
const ssl = /\bsslmode=require\b/.test(url) ? { rejectUnauthorized: false } : undefined
const pool = new Pool({ connectionString: url, max: 1, ssl })

const ORPHANS = ["match_results", "sync_state"]

// Exactly what `drizzle-kit push` produces for lib/db/schema.ts — so a later
// `db:push` against this database reports "No changes detected".
const CREATE_API_CACHE = `
CREATE TABLE IF NOT EXISTS "api_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "payload" text NOT NULL,
  "frozen" boolean DEFAULT false NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL
);`

async function listTables(db) {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  )
  return rows.map((r) => r.table_name)
}

async function main() {
  const db = await pool.connect()
  try {
    const mode = !apply ? "DRY-RUN (read-only)" : dropOrphans ? "APPLY + DROP ORPHANS" : "APPLY"
    console.log(`\n== db-setup — ${mode} ==\n`)

    const before = await listTables(db)
    console.log("Tables present:", before.length ? before.join(", ") : "(none)")

    if (before.includes("api_cache")) {
      const { rows } = await db.query(
        `SELECT id, frozen, fetched_at, length(payload) AS payload_bytes FROM api_cache`,
      )
      console.log("api_cache:", rows.length ? JSON.stringify(rows) : "EXISTS but EMPTY")
    } else {
      console.log("api_cache: MISSING  ->  the running app cannot cache; it refetches every request")
    }

    const orphansPresent = ORPHANS.filter((t) => before.includes(t))
    console.log("Orphaned tables:", orphansPresent.length ? orphansPresent.join(", ") : "(none)")

    if (!apply) {
      console.log("\nDry-run only — nothing changed.")
      console.log("  Create api_cache:      add --apply")
      console.log("  Also drop orphans:     add --apply --drop-orphans (do this AFTER confirming the")
      console.log("                         current code is the live deploy — old code still writes them)\n")
      return
    }

    await db.query("BEGIN")
    await db.query(CREATE_API_CACHE)
    console.log("\n[ok] ensured api_cache exists")
    if (dropOrphans) {
      for (const t of orphansPresent) {
        await db.query(`DROP TABLE IF EXISTS "${t}"`)
        console.log(`[ok] dropped ${t}`)
      }
    } else if (orphansPresent.length) {
      console.log(`[skip] left orphans in place (${orphansPresent.join(", ")}) — re-run with --drop-orphans to remove`)
    }
    await db.query("COMMIT")

    const after = await listTables(db)
    console.log("\nTables now:", after.join(", "), "\n")
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    db.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err.message, "\n")
  process.exit(1)
})
