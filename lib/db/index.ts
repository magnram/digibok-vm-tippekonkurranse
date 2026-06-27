import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

type Db = ReturnType<typeof drizzle<typeof schema>>

// Reuse a single pool across hot reloads in dev (Next.js re-evaluates modules on
// every change, which would otherwise leak connections). In production the
// module-level cache below persists for the lifetime of the serverless instance.
const globalForDb = globalThis as unknown as { __vmtippingPool?: Pool; __vmtippingDb?: Db }

let cachedDb: Db | undefined = globalForDb.__vmtippingDb

// Lazily created so that importing this module never throws (e.g. during the
// Vercel build, or when DATABASE_URL isn't configured). Callers wrap usage in
// try/catch and fall back to a direct API fetch if the DB is unavailable.
export function getDb(): Db {
  if (cachedDb) return cachedDb

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set – see .env.template")
  }

  const pool =
    globalForDb.__vmtippingPool ??
    new Pool({
      connectionString,
      // Keep the local/dev footprint small; bump for higher-traffic deployments.
      max: 5,
      // Managed Postgres providers (e.g. Neon) require TLS; local docker does not.
      ssl: /\bsslmode=require\b/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    })

  const db = drizzle(pool, { schema })
  cachedDb = db
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__vmtippingPool = pool
    globalForDb.__vmtippingDb = db
  }
  return db
}

// Postgres is an optional cache: when it's down the callers serve live data
// directly. Log that as a single concise, actionable warning per scope rather than
// dumping the full driver stack on every request (which React also surfaces as a
// red Server Component error in dev).
const warnedScopes = new Set<string>()
export function warnDbUnavailable(scope: string, err: unknown): void {
  if (warnedScopes.has(scope)) return
  warnedScopes.add(scope)
  const reason =
    err instanceof Error && /DATABASE_URL/.test(err.message) ? "DATABASE_URL not set" : "Postgres unreachable"
  console.warn(
    `[${scope}] ${reason} – serving live data without cache. Run \`npm run db:up && npm run db:push\` to enable caching.`,
  )
}
