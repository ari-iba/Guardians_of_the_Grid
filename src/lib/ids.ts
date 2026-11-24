// Server-only: sequential ids and the transaction type shared by server modules.
import { like } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { echoes, glitches } from '../db/schema.ts'

/** A drizzle transaction (or the db itself): anything with select/insert/update/delete. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbOrTx = typeof db | Tx

/** Next sequential id such as GL-0143 / EC-0009. Call inside a transaction. */
export function nextId(tx: DbOrTx, prefix: 'GL' | 'EC'): string {
  const column = prefix === 'GL' ? glitches.glitchId : echoes.echoId
  const table = prefix === 'GL' ? glitches : echoes
  const rows = tx.select({ id: column }).from(table).where(like(column, `${prefix}-%`)).all()
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(3)) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}
