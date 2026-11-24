import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { echoes, glitches, guardians } from '#/db/schema.ts'
import { requireGuardian } from '#/lib/session.ts'

export type BadgeId = 'first-fix' | 'hat-trick' | 'grid-guardian' | 'bot-buster' | 'speedrunner' | 'field-reporter' | 'top-guardian'

export const BADGES: Record<BadgeId, { emoji: string; label: string; description: string }> = {
  'top-guardian': { emoji: '👑', label: 'Top Guardian', description: 'Most glitches fixed' },
  'first-fix': { emoji: '🔧', label: 'First Fix', description: 'Fixed a first glitch' },
  'hat-trick': { emoji: '🎩', label: 'Hat-trick', description: 'Fixed 3 glitches' },
  'grid-guardian': { emoji: '🛡️', label: 'Grid Guardian', description: 'Fixed 10 glitches' },
  'bot-buster': { emoji: '🤖', label: 'Bot Buster', description: 'Fixed an auto-detected glitch' },
  speedrunner: { emoji: '⚡', label: 'Speedrunner', description: 'Fixed a glitch within 15 minutes of its report' },
  'field-reporter': { emoji: '📡', label: 'Field Reporter', description: 'Reported 5 echoes' },
}

export type LeaderboardEntry = {
  guardianId: string
  codename: string
  rank: number
  fixed: number
  open: number
  echoes: number
  /** Fastest report → FIXED, in minutes (null if nothing fixed). */
  fastestMinutes: number | null
  badges: BadgeId[]
}

const SPEEDRUN_MINUTES = 15

/** Defenders ranked by the number of FIXED glitches assigned to them. */
export const getLeaderboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LeaderboardEntry[]> => {
    requireGuardian()
    const defenders = db
      .select({ guardianId: guardians.guardianId, codename: guardians.codename })
      .from(guardians)
      .where(eq(guardians.role, 'defender'))
      .all()
    const assigned = db
      .select({
        assignee: glitches.assignedGuardianId,
        status: glitches.status,
        source: glitches.source,
        timestamp: glitches.timestamp,
        statusChangedAt: glitches.statusChangedAt,
      })
      .from(glitches)
      .all()
    const reports = db
      .select({ reporter: echoes.reportingGuardianId })
      .from(echoes)
      .where(and(eq(echoes.kind, 'report')))
      .all()

    const entries = defenders.map((d) => {
      const mine = assigned.filter((g) => g.assignee === d.guardianId)
      const fixed = mine.filter((g) => g.status === 'FIXED')
      const durations = fixed.map((g) => (Date.parse(g.statusChangedAt) - Date.parse(g.timestamp)) / 60_000).filter((m) => m >= 0)
      const fastest = durations.length ? Math.round(Math.min(...durations)) : null
      const echoCount = reports.filter((r) => r.reporter === d.guardianId).length
      const badges: BadgeId[] = []
      if (fixed.length >= 1) badges.push('first-fix')
      if (fixed.length >= 3) badges.push('hat-trick')
      if (fixed.length >= 10) badges.push('grid-guardian')
      if (fixed.some((g) => g.source === 'auto')) badges.push('bot-buster')
      if (fastest !== null && fastest <= SPEEDRUN_MINUTES) badges.push('speedrunner')
      if (echoCount >= 5) badges.push('field-reporter')
      return {
        guardianId: d.guardianId,
        codename: d.codename,
        rank: 0,
        fixed: fixed.length,
        open: mine.length - fixed.length,
        echoes: echoCount,
        fastestMinutes: fastest,
        badges,
      }
    })

    entries.sort((a, b) => b.fixed - a.fixed || b.echoes - a.echoes || a.codename.localeCompare(b.codename))
    entries.forEach((e, i) => {
      e.rank = i + 1
      if (i === 0 && e.fixed > 0) e.badges.unshift('top-guardian')
    })
    return entries
  },
)
