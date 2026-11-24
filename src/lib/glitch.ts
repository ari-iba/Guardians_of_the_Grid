import type { District } from './district.ts'
import type { AutoTrigger, GlitchSource, Metric } from './sensors.ts'

/** Lifecycle of a glitch, in order. */
export const GLITCH_STATUSES = [
  'LEAKED',
  'ASSESSING',
  'CONTAINING',
  'FIXED',
] as const

export type GlitchStatus = (typeof GLITCH_STATUSES)[number]

export type Glitch = {
  glitchId: string
  status: GlitchStatus
  description: string
  /** ISO 8601 */
  timestamp: string
  district: District
  /** Defender (or commander) responsible for this glitch, if any. */
  assignedGuardianId: string | null
  /** ISO 8601: when the status last changed (for "time in status"). */
  statusChangedAt: string
  /** `auto` = created by the Desync Engine. */
  source: GlitchSource
  trigger: AutoTrigger | null
  metric: Metric | null
}

/** A glitch as shown in lists: with its echo count and assignee codename. */
export type GlitchSummary = Glitch & {
  echoCount: number
  assignedCodename: string | null
}

/** Position in the lifecycle, 0 = LEAKED … 3 = FIXED. */
export function statusIndex(status: GlitchStatus): number {
  return GLITCH_STATUSES.indexOf(status)
}

/** The status one step forward (+1) or back (-1), or null at either end. */
export function stepStatus(
  status: GlitchStatus,
  direction: 1 | -1,
): GlitchStatus | null {
  return GLITCH_STATUSES[statusIndex(status) + direction] ?? null
}

/** Weight of each status in the magic-loss formula. */
const MAGIC_COST: Record<GlitchStatus, number> = {
  LEAKED: 15,
  ASSESSING: 10,
  CONTAINING: 5,
  FIXED: 0,
}

/** Magic left in Achrona, 0–100. 100 means every glitch is FIXED. */
export function magicLevel(glitches: Pick<Glitch, 'status'>[]): number {
  const loss = glitches.reduce((sum, g) => sum + MAGIC_COST[g.status], 0)
  return Math.max(0, Math.min(100, 100 - loss))
}

/** Lockdown: magic below 40% or at least three glitches LEAKED. */
export function isLockdown(glitches: Pick<Glitch, 'status'>[]): boolean {
  const leaked = glitches.filter((g) => g.status === 'LEAKED').length
  return magicLevel(glitches) < 40 || leaked >= 3
}
