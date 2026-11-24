// Server-only: sensor readings + simulation settings storage.
// Relative imports: also loaded by plain Node (npm run test:workflow, via workflow.ts).
import { and, desc, eq } from 'drizzle-orm'
import { sensorReadings, settings } from '../db/schema.ts'
import { DISTRICTS, type District } from './district.ts'
import type { DbOrTx } from './ids.ts'
import { METRICS, NORMAL_LEVEL, type Metric, type SimulationSettings } from './sensors.ts'

const DEFAULT_SETTINGS: SimulationSettings = { autoDesync: true, autoAssign: false, attacks: {} }

export function readSetting<T>(tx: DbOrTx, key: string, fallback: T): T {
  const row = tx.select().from(settings).where(eq(settings.key, key)).get()
  if (!row) return fallback
  try {
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function writeSetting(tx: DbOrTx, key: string, value: unknown): void {
  const json = JSON.stringify(value)
  tx.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run()
}

export function readSimulation(tx: DbOrTx): SimulationSettings {
  return {
    autoDesync: readSetting(tx, 'autoDesync', DEFAULT_SETTINGS.autoDesync),
    autoAssign: readSetting(tx, 'autoAssign', DEFAULT_SETTINGS.autoAssign),
    attacks: readSetting(tx, 'attacks', DEFAULT_SETTINGS.attacks),
  }
}

/** Last `limit` readings of one series, newest first. */
export function latestReadings(tx: DbOrTx, district: District, metric: Metric, limit: number) {
  return tx
    .select({ value: sensorReadings.value, timestamp: sensorReadings.timestamp })
    .from(sensorReadings)
    .where(and(eq(sensorReadings.district, district), eq(sensorReadings.metric, metric)))
    .orderBy(desc(sensorReadings.id))
    .limit(limit)
    .all()
}

/**
 * Bring a district back to healthy levels: stop its simulated attack and write a normal
 * reading for each metric, so the charts visibly recover.
 */
export function recoverDistrict(tx: DbOrTx, district: District, now = new Date().toISOString()): void {
  const attacks = readSetting<SimulationSettings['attacks']>(tx, 'attacks', {})
  if (attacks[district]) {
    delete attacks[district]
    writeSetting(tx, 'attacks', attacks)
  }
  for (const metric of METRICS) {
    tx.insert(sensorReadings)
      .values({ district, metric, value: NORMAL_LEVEL[metric] + (Math.random() * 4 - 2), timestamp: now })
      .run()
  }
}

export function recoverAllDistricts(tx: DbOrTx): void {
  writeSetting(tx, 'attacks', {})
  const now = new Date().toISOString()
  for (const district of DISTRICTS) recoverDistrict(tx, district, now)
}
