import type { GlitchStatus, GlitchSummary } from './glitch.ts'
import type { StatusChange } from './glitches.functions.ts'

export const REPLAY_WINDOW_MS = 60 * 60_000

/**
 * The glitches as they were at moment `t`: only those reported by then, each with the status
 * it had at that time (from the audit history).
 */
export function snapshotAt(glitches: GlitchSummary[], history: StatusChange[], t: number): GlitchSummary[] {
  const byGlitch = new Map<string, StatusChange[]>()
  for (const change of history) byGlitch.set(change.glitchId, [...(byGlitch.get(change.glitchId) ?? []), change])

  return glitches
    .filter((g) => Date.parse(g.timestamp) <= t)
    .map((g) => ({ ...g, status: statusAt(g.status, byGlitch.get(g.glitchId) ?? [], t) }))
}

function statusAt(current: GlitchStatus, changes: StatusChange[], t: number): GlitchStatus {
  let last: StatusChange | undefined
  for (const c of changes) if (Date.parse(c.timestamp) <= t) last = c
  if (last) return last.to
  // Before the first recorded change it had that change's "from" status.
  if (changes[0]) return changes[0].from
  return current
}

/** Moments worth marking on the slider: new glitches and status changes inside the window. */
export function replayEvents(glitches: GlitchSummary[], history: StatusChange[], start: number, end: number) {
  const events: { t: number; kind: 'new' | 'fixed' | 'change' }[] = []
  for (const g of glitches) {
    const t = Date.parse(g.timestamp)
    if (t >= start && t <= end) events.push({ t, kind: 'new' })
  }
  for (const c of history) {
    const t = Date.parse(c.timestamp)
    if (t >= start && t <= end) events.push({ t, kind: c.to === 'FIXED' ? 'fixed' : 'change' })
  }
  return events
}
