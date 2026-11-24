// Pure workflow rules: no database, so they can be unit-tested and reused by the UI.
// Relative imports so `node --test` can load this file directly.
import type { GlitchStatus } from './glitch.ts'
import type { Role } from './guardian.ts'

export type WorkflowActor = { guardianId: string; codename: string; role: Role }

export type WorkflowGlitch = {
  glitchId: string
  status: GlitchStatus
  assignedGuardianId: string | null
  assignedCodename: string | null
}

export type WorkflowEvent =
  | { type: 'ASSIGNED'; assignee: WorkflowActor }
  | { type: 'UNASSIGNED' }
  | { type: 'UPDATE_ECHO' }
  | { type: 'RESOLVED' }
  | { type: 'NEW_ECHO_ON_FIXED' }
  | { type: 'MANUAL_OVERRIDE'; status: GlitchStatus; reason: string }

export type Transition = {
  from: GlitchStatus
  to: GlitchStatus
  assignedGuardianId: string | null
  /** Human-readable audit line, stored as a SYSTEM echo. */
  summary: string
}

/** A transition the rules refuse. The message is shown to the user as-is. */
export class WorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export const OVERRIDE_REASON_MAX = 200

/** Commanders, and the SYSTEM guardian acting on their behalf (auto-assign). */
const hasCommand = (actor: WorkflowActor) => actor.role === 'commander' || actor.role === 'system'
const isAssignee = (glitch: WorkflowGlitch, actor: WorkflowActor) =>
  glitch.assignedGuardianId !== null && glitch.assignedGuardianId === actor.guardianId

/**
 * Decide what an event does to a glitch.
 * Returns the transition, `null` when the event is valid but changes nothing,
 * or throws a WorkflowError when it is not allowed.
 */
export function decideTransition(
  glitch: WorkflowGlitch,
  event: WorkflowEvent,
  actor: WorkflowActor,
): Transition | null {
  const { glitchId, status } = glitch

  switch (event.type) {
    case 'ASSIGNED': {
      if (!hasCommand(actor)) throw new WorkflowError('Only a commander can assign glitches.')
      if (event.assignee.role !== 'defender') throw new WorkflowError('Glitches can only be assigned to defenders.')
      if (status === 'FIXED') {
        throw new WorkflowError(`${glitchId} is FIXED. It reopens automatically when a new echo arrives.`)
      }
      if (glitch.assignedGuardianId === event.assignee.guardianId) {
        throw new WorkflowError(`${glitchId} is already assigned to ${event.assignee.codename}.`)
      }
      if (status === 'LEAKED') {
        return {
          from: status,
          to: 'ASSESSING',
          assignedGuardianId: event.assignee.guardianId,
          summary: `Status LEAKED → ASSESSING: assigned to ${event.assignee.codename} by ${actor.codename}`,
        }
      }
      return {
        from: status,
        to: status,
        assignedGuardianId: event.assignee.guardianId,
        summary: `Reassigned from ${glitch.assignedCodename ?? 'nobody'} to ${event.assignee.codename} by ${actor.codename} (stays ${status})`,
      }
    }

    case 'UNASSIGNED': {
      if (!hasCommand(actor)) throw new WorkflowError('Only a commander can unassign glitches.')
      if (!glitch.assignedGuardianId) throw new WorkflowError(`${glitchId} is not assigned to anyone.`)
      if (status !== 'ASSESSING') {
        throw new WorkflowError(
          status === 'CONTAINING'
            ? `${glitchId} is being contained. Reassign it to another defender instead.`
            : `${glitchId} is ${status} and cannot be unassigned.`,
        )
      }
      return {
        from: status,
        to: 'LEAKED',
        assignedGuardianId: null,
        summary: `Status ASSESSING → LEAKED: ${glitch.assignedCodename ?? 'defender'} unassigned by ${actor.codename}`,
      }
    }

    case 'UPDATE_ECHO': {
      // Anyone may post echoes; only the assignee or a commander moves the workflow.
      if (!isAssignee(glitch, actor) && !hasCommand(actor)) return null
      if (status !== 'ASSESSING') return null
      return {
        from: status,
        to: 'CONTAINING',
        assignedGuardianId: glitch.assignedGuardianId,
        summary: `Status ASSESSING → CONTAINING: update from ${actor.codename}`,
      }
    }

    case 'RESOLVED': {
      if (!isAssignee(glitch, actor) && !hasCommand(actor)) {
        throw new WorkflowError('Only the assigned defender or a commander can mark this glitch as fixed.')
      }
      if (status !== 'CONTAINING') {
        throw new WorkflowError(`Only CONTAINING glitches can be fixed; ${glitchId} is ${status}.`)
      }
      return {
        from: status,
        to: 'FIXED',
        assignedGuardianId: glitch.assignedGuardianId,
        summary: `Status CONTAINING → FIXED: marked as fixed by ${actor.codename}`,
      }
    }

    case 'NEW_ECHO_ON_FIXED': {
      if (status !== 'FIXED') return null
      const to: GlitchStatus = glitch.assignedGuardianId ? 'ASSESSING' : 'LEAKED'
      return {
        from: status,
        to,
        assignedGuardianId: glitch.assignedGuardianId,
        summary: glitch.assignedGuardianId
          ? `Reopened by a new echo from ${actor.codename}: FIXED → LEAKED → ASSESSING (still assigned to ${glitch.assignedCodename})`
          : `Reopened by a new echo from ${actor.codename}: FIXED → LEAKED`,
      }
    }

    case 'MANUAL_OVERRIDE': {
      if (actor.role !== 'commander') throw new WorkflowError('Only a commander can override the status.')
      const reason = event.reason.trim()
      if (!reason) throw new WorkflowError('A manual override needs a reason.')
      if (reason.length > OVERRIDE_REASON_MAX) {
        throw new WorkflowError(`Keep the reason under ${OVERRIDE_REASON_MAX} characters.`)
      }
      if (event.status === status) throw new WorkflowError(`${glitchId} is already ${status}.`)
      return {
        from: status,
        to: event.status,
        assignedGuardianId: glitch.assignedGuardianId,
        summary: `Manual override by ${actor.codename}: ${status} → ${event.status}. Reason: ${reason}`,
      }
    }
  }
}

export type AllowedActions = {
  assign: boolean
  unassign: boolean
  resolve: boolean
  override: boolean
  /** What moves this glitch forward, in plain words. */
  hint: string
}

/** Which workflow buttons to show. The server still validates every action. */
export function allowedActions(glitch: WorkflowGlitch, actor: WorkflowActor): AllowedActions {
  const command = hasCommand(actor)
  const assignee = isAssignee(glitch, actor)
  const hints: Record<GlitchStatus, string> = {
    LEAKED: 'Waiting for a commander to assign a defender.',
    ASSESSING: assignee
      ? 'Post an update echo to start containment.'
      : `Waiting for an update from ${glitch.assignedCodename ?? 'the assigned defender'}.`,
    CONTAINING: assignee || command ? 'Mark it as fixed once containment holds.' : 'Containment in progress.',
    FIXED: 'Fixed. A new echo on this glitch reopens it.',
  }
  return {
    assign: command && glitch.status !== 'FIXED',
    unassign: command && glitch.status === 'ASSESSING' && !!glitch.assignedGuardianId,
    resolve: (command || assignee) && glitch.status === 'CONTAINING',
    override: actor.role === 'commander',
    hint: hints[glitch.status],
  }
}
