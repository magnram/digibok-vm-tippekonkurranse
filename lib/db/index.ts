import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Reuse a single pool across hot reloads in dev (Next.js re-evaluates modules on
// every change, which would otherwise leak connections).
const globalForDb = globalThis as unknown as { __vmtippingPool?: Pool }

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set – see .env.template")
  }
  return new Pool({
    connectionString,
    // Keep the local/dev footprint small; bump for higher-traffic deployments.
    max: 5,
    // Managed Postgres providers usually require TLS; local docker does not.
    ssl: /\bsslmode=require\b/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  })
}

const pool = globalForDb.__vmtippingPool ?? createPool()
if (process.env.NODE_ENV !== "production") globalForDb.__vmtippingPool = pool

export const db = drizzle(pool, { schema })
