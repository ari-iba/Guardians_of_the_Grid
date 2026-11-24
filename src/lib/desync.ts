// Server-only: the Desync Engine. Simulates district sensors and creates glitches automatically.
import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { echoes, glitches, guardians, sensorReadings } from '../db/schema.ts'
import { DISTRICTS, DISTRICT_LABELS, type District } from './district.ts'
import { SYSTEM_GUARDIAN } from './guardian.ts'
import { nextId, type DbOrTx, type Tx } from './ids.ts'
import { latestReadings, readSetting, readSimulation, recoverAllDistricts, writeSetting } from './sensor-store.ts'
import {
  METRICS,
  METRIC_LABELS,
  NORMAL_LEVEL,
  RAPID_DROP,
  RAPID_DROP_WINDOW,
  SENSOR_THRESHOLD,
  TICK_INTERVAL_MS,
  type AutoTrigger,
  type Metric,
  type SimulationSettings,
} from './sensors.ts'
import { transitionGlitch } from './workflow.ts'

/** A sensor that keeps failing adds at most one echo per minute to its open glitch. */
const REPEAT_ECHO_MS = 60_000
/** ±1 spontaneous Desync event per ~2.5 minutes at one tick per 5 s. */
const RANDOM_EVENT_CHANCE = TICK_INTERVAL_MS / 150_000
const CLUSTER_WINDOW_MS = 2 * 60_000
const CLUSTER_MIN_GUARDIANS = 3

const DESYNC_EVENTS: Record<District, string[]> = {
  clocktower: ['Time loop near the eastern clock tower', 'Clock hands spinning backwards in the Clocktower Quarter'],
  archives: ['Books rewriting themselves in the Archive Vaults', 'Index runes flickering out in the archives'],
  'old-market': ['Market stalls phasing in and out of existence', 'Merchants trading with coins from tomorrow'],
  harbor: ['Crystal lighthouse refracting into parallel harbors', 'Tides frozen mid-wave in Crystal Harbor'],
  'ember-fields': ['Ember Fields burning with cold blue fire', 'Fireflies forming Desync glyphs over the fields'],
  skyforge: ['Skyforge anvils floating off their pedestals', 'Forge sparks falling upwards in the Skyforge'],
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]
const clamp = (v: number) => Math.max(0, Math.min(100, v))
const round = (v: number) => Math.round(v * 10) / 10

/** Defender with the fewest open glitches (ties: alphabetical). */
function leastBusyDefender(tx: DbOrTx) {
  return tx
    .select({
      guardianId: guardians.guardianId,
      codename: guardians.codename,
      role: guardians.role,
      open: sql<number>`(select count(*) from ${glitches} where ${glitches.assignedGuardianId} = ${guardians.guardianId} and ${glitches.status} <> 'FIXED')`,
    })
    .from(guardians)
    .where(eq(guardians.role, 'defender'))
    .all()
    .sort((a, b) => a.open - b.open || a.codename.localeCompare(b.codename))[0]
}

type CreateGlitchInput = {
  district: District
  trigger: AutoTrigger
  metric?: Metric | null
  description: string
  /** First echo, written by SYSTEM. */
  echo: string
  now?: string
}

/**
 * Create an auto-detected glitch (SYSTEM reporter, LEAKED, source `auto`).
 * Sensor triggers are de-duplicated: while an open glitch exists for the same district + metric,
 * an echo is added to it instead (at most once a minute). Returns the new glitch id, or null.
 */
export function createGlitch(tx: Tx, input: CreateGlitchInput): string | null {
  const now = input.now ?? new Date().toISOString()

  if (input.metric) {
    const open = tx
      .select({ glitchId: glitches.glitchId })
      .from(glitches)
      .where(
        and(
          eq(glitches.source, 'auto'),
          eq(glitches.district, input.district),
          eq(glitches.metric, input.metric),
          ne(glitches.status, 'FIXED'),
        ),
      )
      .get()
    if (open) {
      const last = tx
        .select({ timestamp: sql<string>`max(${echoes.timestamp})` })
        .from(echoes)
        .where(and(eq(echoes.glitchId, open.glitchId), eq(echoes.kind, 'report')))
        .get()
      if (!last?.timestamp || Date.parse(now) - Date.parse(last.timestamp) >= REPEAT_ECHO_MS) {
        tx.insert(echoes)
          .values({ echoId: nextId(tx, 'EC'), glitchId: open.glitchId, district: input.district, description: input.echo, timestamp: now, reportingGuardianId: SYSTEM_GUARDIAN.guardianId, kind: 'report' })
          .run()
      }
      return null
    }
  }

  const glitchId = nextId(tx, 'GL')
  tx.insert(glitches)
    .values({
      glitchId,
      status: 'LEAKED',
      description: input.description,
      timestamp: now,
      statusChangedAt: now,
      district: input.district,
      assignedGuardianId: null,
      source: 'auto',
      trigger: input.trigger,
      metric: input.metric ?? null,
    })
    .run()
  tx.insert(echoes)
    .values({ echoId: nextId(tx, 'EC'), glitchId, district: input.district, description: input.echo, timestamp: now, reportingGuardianId: SYSTEM_GUARDIAN.guardianId, kind: 'report' })
    .run()

  if (readSetting(tx, 'autoAssign', false)) {
    const defender = leastBusyDefender(tx)
    if (defender) {
      transitionGlitch(glitchId, { type: 'ASSIGNED', assignee: defender }, SYSTEM_GUARDIAN, tx)
    }
  }
  return glitchId
}

/** One step of every sensor + all automatic triggers. Returns ids of newly created glitches. */
function runTick(tx: Tx, simulation: SimulationSettings, now: string): string[] {
  const created: string[] = []
  const nowMs = Date.parse(now)

  for (const district of DISTRICTS) {
    const attacked = simulation.attacks[district] ?? []
    for (const metric of METRICS) {
      const history = latestReadings(tx, district, metric, RAPID_DROP_WINDOW - 1)
      const previous = history[0]?.value ?? NORMAL_LEVEL[metric]
      const value = round(
        clamp(
          attacked.includes(metric)
            ? Math.max(3, previous - (7 + Math.random() * 7)) // crash fast, then flatline near zero
            : previous + (NORMAL_LEVEL[metric] - previous) * 0.12 + (Math.random() - 0.5) * 5, // random walk around normal
        ),
      )
      tx.insert(sensorReadings).values({ district, metric, value, timestamp: now }).run()

      const label = METRIC_LABELS[metric].toLowerCase()
      const window = [{ value, timestamp: now }, ...history]
      const peak = window.reduce((best, r) => (r.value > best.value ? r : best), window[0])
      const drop = Math.round(peak.value - value)
      const seconds = Math.max(5, Math.round((nowMs - Date.parse(peak.timestamp)) / 1000))

      let trigger: AutoTrigger | null = null
      let text = ''
      if (drop > RAPID_DROP) {
        trigger = 'drop'
        text = `Auto-detected: ${label} in ${DISTRICT_LABELS[district]} dropped ${drop}% in ${seconds}s`
      } else if (value < SENSOR_THRESHOLD) {
        trigger = 'threshold'
        text = `Auto-detected: ${label} in ${DISTRICT_LABELS[district]} fell to ${Math.round(value)}% (threshold ${SENSOR_THRESHOLD}%)`
      }
      if (trigger) {
        const id = createGlitch(tx, { district, metric, trigger, description: text, echo: text, now })
        if (id) created.push(id)
      }
    }
  }

  if (simulation.autoDesync && Math.random() < RANDOM_EVENT_CHANCE) {
    const district = pick(DISTRICTS)
    const description = pick(DESYNC_EVENTS[district])
    const id = createGlitch(tx, {
      district,
      trigger: 'random',
      description,
      echo: `Desync event picked up by the ${DISTRICT_LABELS[district]} sensor grid.`,
      now,
    })
    if (id) created.push(id)
    // Let the event leave a visible dent in the district's magic.
    const last = latestReadings(tx, district, 'magic', 1)[0]?.value ?? NORMAL_LEVEL.magic
    tx.insert(sensorReadings).values({ district, metric: 'magic', value: round(clamp(last - 18)), timestamp: now }).run()
  }

  // Keep ~3 hours of history.
  tx.delete(sensorReadings).where(lt(sensorReadings.timestamp, new Date(nowMs - 3 * 3600_000).toISOString())).run()
  return created
}

/**
 * Advance the simulation by one tick, at most once per TICK_INTERVAL_MS across all clients
 * (the check-and-set happens inside one SQLite transaction, so parallel tabs can't double-tick).
 */
export function tick(): { ticked: boolean; created: string[] } {
  return db.transaction((tx) => {
    const nowMs = Date.now()
    const last = readSetting(tx, 'lastTickAt', 0)
    if (nowMs - last < TICK_INTERVAL_MS - 250) return { ticked: false, created: [] }
    writeSetting(tx, 'lastTickAt', nowMs)
    return { ticked: true, created: runTick(tx, readSimulation(tx), new Date(nowMs).toISOString()) }
  })
}

/**
 * Echo cluster: when a new report would open a glitch in a district where at least two other
 * guardians reported within the last 2 minutes, bundle all of them under one auto-glitch.
 * Returns the glitch id the new echo belongs to, or null to create a normal glitch.
 */
export function bundleIntoCluster(tx: Tx, district: District, reporterId: string, nowIso: string): string | null {
  const since = new Date(Date.parse(nowIso) - CLUSTER_WINDOW_MS).toISOString()

  // A recent cluster in this district simply absorbs the new report.
  const cluster = tx
    .select({ glitchId: glitches.glitchId })
    .from(glitches)
    .where(and(eq(glitches.district, district), eq(glitches.trigger, 'cluster'), ne(glitches.status, 'FIXED'), gte(glitches.timestamp, since)))
    .get()
  if (cluster) return cluster.glitchId

  // Fresh, untouched manual glitches from the window are candidates to merge.
  const candidates = tx
    .select({ glitchId: glitches.glitchId })
    .from(glitches)
    .where(
      and(
        eq(glitches.district, district),
        eq(glitches.source, 'manual'),
        eq(glitches.status, 'LEAKED'),
        sql`${glitches.assignedGuardianId} is null`,
        gte(glitches.timestamp, since),
      ),
    )
    .all()
    .map((g) => g.glitchId)
  if (candidates.length === 0) return null

  const reports = tx
    .select({ echoId: echoes.echoId, reporter: echoes.reportingGuardianId, timestamp: echoes.timestamp })
    .from(echoes)
    .where(and(inArray(echoes.glitchId, candidates), eq(echoes.kind, 'report')))
    .all()
  const reporters = new Set([...reports.map((r) => r.reporter), reporterId])
  if (reporters.size < CLUSTER_MIN_GUARDIANS) return null

  const names = tx
    .select({ codename: guardians.codename })
    .from(guardians)
    .where(inArray(guardians.guardianId, [...reporters]))
    .all()
    .map((g) => g.codename)
    .sort()
  const text = `Echo cluster: ${reporters.size} guardians (${names.join(', ')}) reported trouble in ${DISTRICT_LABELS[district]} within 2 minutes`
  const glitchId = createGlitch(tx, { district, trigger: 'cluster', description: text, echo: text, now: nowIso })!

  // Move the individual reports under the cluster and drop their now-empty glitches.
  tx.update(echoes).set({ glitchId }).where(inArray(echoes.glitchId, candidates)).run()
  tx.delete(glitches).where(inArray(glitches.glitchId, candidates)).run()
  return glitchId
}

// ---------- commander controls ----------

export function setSimulationFlag(key: 'autoDesync' | 'autoAssign', value: boolean): void {
  writeSetting(db, key, value)
}

/** Crash 2–3 districts (1–2 metrics each). The tick does the rest. */
export function simulateAttack(): District[] {
  return db.transaction((tx) => {
    const attacks = readSetting<SimulationSettings['attacks']>(tx, 'attacks', {})
    const pool = DISTRICTS.filter((d) => !attacks[d]).sort(() => Math.random() - 0.5)
    const targets = pool.slice(0, 2 + Math.round(Math.random()))
    for (const district of targets) {
      const metrics = [...METRICS].sort(() => Math.random() - 0.5).slice(0, 1 + Math.round(Math.random()))
      attacks[district] = metrics
    }
    writeSetting(tx, 'attacks', attacks)
    return targets
  })
}

export function resetSimulation(): void {
  db.transaction((tx) => recoverAllDistricts(tx))
}
