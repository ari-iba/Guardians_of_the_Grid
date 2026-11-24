import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { echoes, glitches, guardians } from '#/db/schema.ts'
import { isDistrict, type District } from '#/lib/district.ts'
import { ECHO_DESCRIPTION_MAX, type EchoWithReporter } from '#/lib/echo.ts'
import { GLITCH_STATUSES, type GlitchStatus, type GlitchSummary } from '#/lib/glitch.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { nextId } from '#/lib/ids.ts'
import { requireCommander, requireGuardian } from '#/lib/session.ts'
import { transitionGlitch } from '#/lib/workflow.ts'

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

function selectSummaries() {
  return db
    .select({
      glitchId: glitches.glitchId,
      status: glitches.status,
      description: glitches.description,
      timestamp: glitches.timestamp,
      district: glitches.district,
      assignedGuardianId: glitches.assignedGuardianId,
      statusChangedAt: glitches.statusChangedAt,
      assignedCodename: guardians.codename,
      // Audit lines are not sightings, so they don't count as echoes.
      echoCount: count(echoes.echoId),
    })
    .from(glitches)
    .leftJoin(guardians, eq(guardians.guardianId, glitches.assignedGuardianId))
    .leftJoin(echoes, and(eq(echoes.glitchId, glitches.glitchId), eq(echoes.kind, 'report')))
    .groupBy(glitches.glitchId)
}

/** Result of an action that may have moved the workflow; drives the "now ASSESSING" toast. */
export type WorkflowOutcome = { glitchId: string; status: GlitchStatus; changed: boolean; summary: string | null }

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
        district: echoes.district,
        reportingGuardianId: echoes.reportingGuardianId,
        glitchId: echoes.glitchId,
        kind: echoes.kind,
        statusBefore: echoes.statusBefore,
        statusAfter: echoes.statusAfter,
        reporterCodename: guardians.codename,
      })
      .from(echoes)
      .innerJoin(guardians, eq(guardians.guardianId, echoes.reportingGuardianId))
      .where(eq(echoes.glitchId, data.glitchId))
      .orderBy(asc(echoes.timestamp), asc(echoes.echoId))
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
 * glitch by default); with `glitchId` it is added as an update to that glitch, which
 * may move the workflow (UPDATE_ECHO / NEW_ECHO_ON_FIXED).
 */
export const createEcho = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = asRecord(input)
    const glitchId = record.glitchId == null ? null : glitchIdFrom(record.glitchId)
    if (!glitchId && !isDistrict(record.district)) throw new Error('Pick the district where you saw it.')
    return {
      description: descriptionFrom(record.description),
      glitchId,
      district: isDistrict(record.district) ? record.district : null,
    }
  })
  .handler(async ({ data }) => {
    const guardian = requireGuardian()
    const now = new Date().toISOString()

    return db.transaction((tx) => {
      let glitchId = data.glitchId
      let district: District
      let existingStatus: GlitchStatus | null = null
      if (glitchId) {
        const existing = tx
          .select({ district: glitches.district, status: glitches.status })
          .from(glitches)
          .where(eq(glitches.glitchId, glitchId))
          .get()
        if (!existing) throw new Error(`Glitch ${glitchId} does not exist.`)
        district = existing.district
        existingStatus = existing.status
      } else {
        district = data.district!
        glitchId = nextId(tx, 'GL')
        tx.insert(glitches)
          .values({
            glitchId,
            status: 'LEAKED',
            description: data.description,
            timestamp: now,
            district,
            assignedGuardianId: null,
            statusChangedAt: now,
          })
          .run()
      }
      const echoId = nextId(tx, 'EC')
      tx.insert(echoes)
        .values({ echoId, description: data.description, timestamp: now, district, reportingGuardianId: guardian.guardianId, glitchId, kind: 'report' })
        .run()

      let outcome: WorkflowOutcome = { glitchId, status: existingStatus ?? 'LEAKED', changed: false, summary: null }
      if (existingStatus) {
        const result = transitionGlitch(
          glitchId,
          { type: existingStatus === 'FIXED' ? 'NEW_ECHO_ON_FIXED' : 'UPDATE_ECHO' },
          guardian,
          tx,
        )
        outcome = {
          glitchId,
          status: result.status,
          changed: !!result.transition && result.transition.from !== result.transition.to,
          summary: result.transition?.summary ?? null,
        }
      }
      return { echoId, createdGlitch: !data.glitchId, ...outcome }
    })
  })

function outcomeOf(result: ReturnType<typeof transitionGlitch>): WorkflowOutcome {
  return {
    glitchId: result.glitchId,
    status: result.status,
    changed: !!result.transition && result.transition.from !== result.transition.to,
    summary: result.transition?.summary ?? null,
  }
}

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
  .handler(async ({ data }): Promise<WorkflowOutcome> => {
    const commander = requireCommander()
    if (!data.guardianId) {
      return outcomeOf(transitionGlitch(data.glitchId, { type: 'UNASSIGNED' }, commander))
    }
    const assignee = db
      .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
      .from(guardians)
      .where(eq(guardians.guardianId, data.guardianId))
      .get()
    if (!assignee) throw new Error('That guardian does not exist.')
    return outcomeOf(transitionGlitch(data.glitchId, { type: 'ASSIGNED', assignee }, commander))
  })

/** Assigned defender or commander: CONTAINING → FIXED. */
export const resolveGlitch = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ({ glitchId: glitchIdFrom(asRecord(input).glitchId) }))
  .handler(async ({ data }): Promise<WorkflowOutcome> => {
    const guardian = requireGuardian()
    return outcomeOf(transitionGlitch(data.glitchId, { type: 'RESOLVED' }, guardian))
  })

/** Commander only: force any status, with a mandatory reason. */
export const overrideGlitchStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = asRecord(input)
    const status = GLITCH_STATUSES.find((s) => s === record.status)
    if (!status) throw new Error('Invalid status.')
    return {
      glitchId: glitchIdFrom(record.glitchId),
      status,
      reason: typeof record.reason === 'string' ? record.reason : '',
    }
  })
  .handler(async ({ data }): Promise<WorkflowOutcome> => {
    const commander = requireCommander()
    return outcomeOf(
      transitionGlitch(data.glitchId, { type: 'MANUAL_OVERRIDE', status: data.status, reason: data.reason }, commander),
    )
  })
