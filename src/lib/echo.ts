/** A sighting reported by a guardian. Every echo belongs to exactly one glitch. */
export type Echo = {
  echoId: string
  description: string
  /** ISO 8601 */
  timestamp: string
  reportingGuardianId: string
  glitchId: string
}

/** An echo with the reporter's codename, for timelines. */
export type EchoWithReporter = Echo & {
  reporterCodename: string
}

/** Longest echo description the server accepts. */
export const ECHO_DESCRIPTION_MAX = 500
