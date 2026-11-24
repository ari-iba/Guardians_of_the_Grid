import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gte } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { glitches } from '#/db/schema.ts'
import { DISTRICTS, type District } from '#/lib/district.ts'
import { resetSimulation, setSimulationFlag, simulateAttack, tick } from '#/lib/desync.ts'
import type { GlitchStatus } from '#/lib/glitch.ts'
import { latestReadings, readSimulation } from '#/lib/sensor-store.ts'
import { METRICS, type AutoTrigger, type Metric, type SensorPoint, type SimulationSettings } from '#/lib/sensors.ts'
import { requireCommander, requireGuardian } from '#/lib/session.ts'

/** Called by every client's live poll; the server makes sure it only ticks once per 5 s. */
export const tickSensors = createServerFn({ method: 'POST' }).handler(async () => {
  requireGuardian()
  return tick()
})

const POINTS = 60

export type AutoGlitchMarker = {
  glitchId: string
  district: District
  metric: Metric | null
  trigger: AutoTrigger | null
  status: GlitchStatus
  timestamp: string
}

export type SensorDashboard = {
  series: Record<District, Record<Metric, SensorPoint[]>>
  markers: AutoGlitchMarker[]
  simulation: SimulationSettings
}

export const getSensorDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SensorDashboard> => {
    requireGuardian()
    let oldest = new Date().toISOString()
    const series = Object.fromEntries(
      DISTRICTS.map((district) => [
        district,
        Object.fromEntries(
          METRICS.map((metric) => {
            const points = latestReadings(db, district, metric, POINTS).reverse()
            if (points[0] && points[0].timestamp < oldest) oldest = points[0].timestamp
            return [metric, points]
          }),
        ),
      ]),
    ) as SensorDashboard['series']

    const markers = db
      .select({
        glitchId: glitches.glitchId,
        district: glitches.district,
        metric: glitches.metric,
        trigger: glitches.trigger,
        status: glitches.status,
        timestamp: glitches.timestamp,
      })
      .from(glitches)
      .where(and(eq(glitches.source, 'auto'), gte(glitches.timestamp, oldest)))
      .orderBy(asc(glitches.timestamp))
      .all()

    return { series, markers, simulation: readSimulation(db) }
  },
)

/** Latest magic reading per district (0–100) — for the map tooltip and heatmap layer. */
export const getDistrictMagic = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Record<District, number>> => {
    requireGuardian()
    return Object.fromEntries(
      DISTRICTS.map((d) => [d, Math.round(latestReadings(db, d, 'magic', 1)[0]?.value ?? 80)]),
    ) as Record<District, number>
  },
)

export const setSimulationOption = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { key, value } = (input ?? {}) as Record<string, unknown>
    if ((key !== 'autoDesync' && key !== 'autoAssign') || typeof value !== 'boolean') throw new Error('Invalid setting.')
    return { key, value } as { key: 'autoDesync' | 'autoAssign'; value: boolean }
  })
  .handler(async ({ data }) => {
    requireCommander()
    setSimulationFlag(data.key, data.value)
    return { ok: true }
  })

export const startSimulatedAttack = createServerFn({ method: 'POST' }).handler(async () => {
  requireCommander()
  return { districts: simulateAttack() }
})

export const resetSensorSimulation = createServerFn({ method: 'POST' }).handler(async () => {
  requireCommander()
  resetSimulation()
  return { ok: true }
})
