import type { District } from './district.ts'
import type { GlitchStatus } from './glitch.ts'

export const ECHO_KINDS = ['report', 'audit'] as const
export type EchoKind = (typeof ECHO_KINDS)[number]

/** A sighting reported by a guardian, or an audit line. Every echo belongs to exactly one glitch. */
export type Echo = {
  echoId: string
  description: string
  /** ISO 8601 */
  timestamp: string
  district: District
  reportingGuardianId: string
  glitchId: string
  kind: EchoKind
  statusBefore: GlitchStatus | null
  statusAfter: GlitchStatus | null
}

/** An echo with the reporter's codename, for timelines. */
export type EchoWithReporter = Echo & {
  reporterCodename: string
}

/** Longest echo description the server accepts. */
export const ECHO_DESCRIPTION_MAX = 500
