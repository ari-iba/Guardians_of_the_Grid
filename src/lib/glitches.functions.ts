import { createServerFn } from '@tanstack/react-start'
import { asc, count, desc, eq, like } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { echoes, glitches, guardians } from '#/db/schema.ts'
import { ECHO_DESCRIPTION_MAX, type EchoWithReporter } from '#/lib/echo.ts'
import { stepStatus, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { requireCommander, requireGuardian } from '#/lib/session.ts'

// ---------- input validation (runs on the server) ----------

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid request.')
  return input as Record<string, unknown>
}

function glitchIdFrom(value: unknown): string {
  if (typeof value !== 'string' || !/^GL-\d{1,8}$/.test(value)) {
    throw new Error('Invalid glitch id.')
  }
  return value
}

function descriptionFrom(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error('Describe what you saw — the description cannot be empty.')
  if (text.length > ECHO_DESCRIPTION_MAX) {
    throw new Error(`Keep it under ${ECHO_DESCRIPTION_MAX} characters (now ${text.length}).`)
  }
  return text
}

// ---------- helpers ----------

/** Next sequential id such as GL-0143 / EC-0009. Call inside a transaction. */
function nextId(
  tx: Pick<typeof db, 'select'>,
  prefix: 'GL' | 'EC',
): string {
  const column = prefix === 'GL' ? glitches.glitchId : echoes.echoId
  const table = prefix === 'GL' ? glitches : echoes
  const rows = tx.select({ id: column }).from(table).where(like(column, `${prefix}-%`)).all()
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(3)) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

function selectSummaries() {
  return db
    .select({
      glitchId: glitches.glitchId,
      status: glitches.status,
      description: glitches.description,
      timestamp: glitches.timestamp,
      assignedGuardianId: glitches.assignedGuardianId,
      assignedCodename: guardians.codename,
      echoCount: count(echoes.echoId),
    })
    .from(glitches)
    .leftJoin(guardians, eq(guardians.guardianId, glitches.assignedGuardianId))
    .leftJoin(echoes, eq(echoes.glitchId, glitches.glitchId))
    .groupBy(glitches.glitchId)
}

// ---------- queries ----------

export const getGlitches = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GlitchSummary[]> => {
    requireGuardian()
    return selectSummaries().orderBy(desc(glitches.timestamp)).all()
  },
)

export type GlitchDetail = { glitch: GlitchSummary; echoes: EchoWithReporter[] }

export const getGlitch = createServerFn({ method: 'GET' })
  .validator((input: unknown) => ({ glitchId: glitchIdFrom(asRecord(input).glitchId) }))
  .handler(async ({ data }): Promise<GlitchDetail | null> => {
    requireGuardian()
    const glitch = selectSummaries().where(eq(glitches.glitchId, data.glitchId)).get()
    if (!glitch) return null
    const timeline = db
      .select({
        echoId: echoes.echoId,
        description: echoes.description,
        timestamp: echoes.timestamp,
        reportingGuardianId: echoes.reportingGuardianId,
        glitchId: echoes.glitchId,
        reporterCodename: guardians.codename,
      })
      .from(echoes)
      .innerJoin(guardians, eq(guardians.guardianId, echoes.reportingGuardianId))
      .where(eq(echoes.glitchId, data.glitchId))
      .orderBy(asc(echoes.timestamp))
      .all()
    return { glitch, echoes: timeline }
  })

/** Guardians a commander can assign glitches to. */
export const getDefenders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Guardian[]> => {
    requireGuardian()
    return db
      .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
      .from(guardians)
      .where(eq(guardians.role, 'defender'))
      .orderBy(asc(guardians.codename))
      .all()
  },
)

// ---------- mutations ----------

/**
 * Report an echo. Without `glitchId` it opens a new LEAKED glitch (every echo is a
 * glitch by default); with `glitchId` it is added as an update to that glitch.
 */
export const createEcho = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = asRecord(input)
    return {
      description: descriptionFrom(record.description),
      glitchId: record.glitchId == null ? null : glitchIdFrom(record.glitchId),
    }
  })
  .handler(async ({ data }) => {
    const guardian = requireGuardian()
    const now = new Date().toISOString()

    return db.transaction((tx) => {
      let glitchId = data.glitchId
      if (glitchId) {
        const exists = tx.select({ id: glitches.glitchId }).from(glitches).where(eq(glitches.glitchId, glitchId)).get()
        if (!exists) throw new Error(`Glitch ${glitchId} does not exist.`)
      } else {
        glitchId = nextId(tx, 'GL')
        tx.insert(glitches)
          .values({ glitchId, status: 'LEAKED', description: data.description, timestamp: now, assignedGuardianId: null })
          .run()
      }
      const echoId = nextId(tx, 'EC')
      tx.insert(echoes)
        .values({ echoId, description: data.description, timestamp: now, reportingGuardianId: guardian.guardianId, glitchId })
        .run()
      return { glitchId, echoId, createdGlitch: !data.glitchId }
    })
  })

/** Commander only: move a glitch one step forward or back in its lifecycle. */
export const stepGlitchStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = asRecord(input)
    if (record.direction !== 1 && record.direction !== -1) throw new Error('Invalid direction.')
    return { glitchId: glitchIdFrom(record.glitchId), direction: record.direction as 1 | -1 }
  })
  .handler(async ({ data }) => {
    requireCommander()
    const row = db.select({ status: glitches.status }).from(glitches).where(eq(glitches.glitchId, data.glitchId)).get()
    if (!row) throw new Error(`Glitch ${data.glitchId} does not exist.`)
    const status = stepStatus(row.status, data.direction)
    if (!status) throw new Error(`${data.glitchId} is already ${row.status}.`)
    db.update(glitches).set({ status }).where(eq(glitches.glitchId, data.glitchId)).run()
    return { status }
  })

/** Commander only: assign a glitch to a defender, or unassign with `guardianId: null`. */
export const assignGlitch = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = asRecord(input)
    const guardianId = record.guardianId
    if (guardianId !== null && (typeof guardianId !== 'string' || guardianId.length > 32)) {
      throw new Error('Invalid guardian.')
    }
    return { glitchId: glitchIdFrom(record.glitchId), guardianId: guardianId as string | null }
  })
  .handler(async ({ data }) => {
    requireCommander()
    if (data.guardianId) {
      const target = db.select({ role: guardians.role }).from(guardians).where(eq(guardians.guardianId, data.guardianId)).get()
      if (!target) throw new Error('That guardian does not exist.')
      if (target.role !== 'defender') throw new Error('Glitches can only be assigned to defenders.')
    }
    const result = db
      .update(glitches)
      .set({ assignedGuardianId: data.guardianId })
      .where(eq(glitches.glitchId, data.glitchId))
      .run()
    if (result.changes === 0) throw new Error(`Glitch ${data.glitchId} does not exist.`)
    return { ok: true }
  })
