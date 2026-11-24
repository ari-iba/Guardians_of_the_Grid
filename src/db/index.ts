import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.ts'

// Server-only: never import this from client code.

// Pick up .env (DB_FILE_NAME, SESSION_SECRET) without a dependency; a missing file is fine.
try {
  process.loadEnvFile()
} catch {
  /* no .env */
}

const sqlite = new Database(process.env.DB_FILE_NAME ?? 'local.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
