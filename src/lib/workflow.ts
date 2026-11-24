// Server-only workflow engine. This is the ONLY place that writes `glitches.status`.
// Relative imports (not #/): this module is also loaded by plain Node in npm run test:workflow.
import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { echoes, glitches, guardians } from '../db/schema.ts'
import { SYSTEM_GUARDIAN, type Guardian } from './guardian.ts'
import { nextId, type Tx } from './ids.ts'
import {
  decideTransition,
  type Transition,
  type WorkflowEvent,
} from './workflow-rules.ts'
import type { GlitchStatus } from './glitch.ts'

export type TransitionResult = {
  glitchId: string
  status: GlitchStatus
  /** null when the event was valid but changed nothing. */
  transition: Transition | null
}

/**
 * Apply a workflow event to a glitch: validate it against the rules, update status/assignee,
 * stamp `status_changed_at` and write an audit echo from SYSTEM.
 * Throws WorkflowError for transitions the rules refuse.
 * Pass `tx` to join an outer transaction; otherwise it opens its own.
 */
export function transitionGlitch(
  glitchId: string,
  event: WorkflowEvent,
  actor: Guardian,
  tx?: Tx,
): TransitionResult {
  const run = (t: Tx): TransitionResult => {
    const row = t
      .select({
        glitchId: glitches.glitchId,
        status: glitches.status,
        district: glitches.district,
        assignedGuardianId: glitches.assignedGuardianId,
        assignedCodename: guardians.codename,
      })
      .from(glitches)
      .leftJoin(guardians, eq(guardians.guardianId, glitches.assignedGuardianId))
      .where(eq(glitches.glitchId, glitchId))
      .get()
    if (!row) throw new Error(`Glitch ${glitchId} does not exist.`)

    const transition = decideTransition(row, event, actor)
    if (!transition) return { glitchId, status: row.status, transition: null }

    const now = new Date().toISOString()
    t.update(glitches)
      .set({
        status: transition.to,
        assignedGuardianId: transition.assignedGuardianId,
        ...(transition.to !== transition.from ? { statusChangedAt: now } : {}),
      })
      .where(eq(glitches.glitchId, glitchId))
      .run()

    t.insert(echoes)
      .values({
        echoId: nextId(t, 'EC'),
        glitchId,
        district: row.district,
        description: transition.summary,
        timestamp: now,
        reportingGuardianId: SYSTEM_GUARDIAN.guardianId,
        kind: 'audit',
        statusBefore: transition.from,
        statusAfter: transition.to,
      })
      .run()

    return { glitchId, status: transition.to, transition }
  }

  return tx ? run(tx) : db.transaction(run)
}
