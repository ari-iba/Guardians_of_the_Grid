// Guardians as players: XP, levels, daily quests and achievements.
// Pure and derived: everything is computed from the existing echoes (reports + the SYSTEM
// audit log that the workflow engine writes), so no extra table is needed and nothing
// can drift out of sync. Relative imports: also loaded by plain Node in the tests.
import { DISTRICTS, DISTRICT_LABELS, type District } from './district.ts'
import { isLockdown, type GlitchStatus } from './glitch.ts'
import type { Role } from './guardian.ts'
import { hashString, seededRandom } from './monster.ts'

// ---------- XP and levels ----------

export const XP = {
  echo: 10,
  assigned: 5,
  contain: 15,
  fix: 50,
  wildFix: 25,
} as const

export const XP_RULES: { label: string; xp: number }[] = [
  { label: 'Report an echo', xp: XP.echo },
  { label: 'Get a glitch assigned to you', xp: XP.assigned },
  { label: 'Move a glitch to CONTAINING', xp: XP.contain },
  { label: 'Fix a glitch', xp: XP.fix },
  { label: 'Bonus: fix a wild spawn (🤖)', xp: XP.wildFix },
  { label: 'Complete a daily quest', xp: 0 },
]

const TITLES = ['Apprentice', 'Watcher', 'Runesmith', 'Timekeeper', 'Warden', 'Archmage', 'Grid Sentinel', 'Legend of Achrona']

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600, …). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelFor(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export function levelTitle(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1]
}

// ---------- Inputs ----------

export type ProgressGuardian = { guardianId: string; codename: string; role: Role }
export type ProgressGlitch = { glitchId: string; district: District; source: 'manual' | 'auto'; timestamp: string }
export type ProgressEcho = {
  echoId: string
  glitchId: string
  district: District
  timestamp: string
  reportingGuardianId: string
  kind: 'report' | 'audit'
  description: string
  statusBefore: GlitchStatus | null
  statusAfter: GlitchStatus | null
}

// ---------- Actions (what a guardian did) ----------

export type ActionKind = 'echo' | 'assigned' | 'deploy' | 'contain' | 'fix' | 'wild-fix'

export type Action = {
  guardianId: string
  kind: ActionKind
  timestamp: string
  glitchId: string
  district: District
}

export type XpReason = 'echo' | 'assigned' | 'contain' | 'fix' | 'wild-fix' | 'quest'

export type XpEvent = {
  reason: XpReason
  xp: number
  timestamp: string
  label: string
  glitchId?: string
}

/** Who did what, replayed in order from the reports and the workflow audit log. */
export function deriveActions(
  guardians: ProgressGuardian[],
  glitches: ProgressGlitch[],
  echoes: ProgressEcho[],
): { actions: Action[]; lockdownBreaks: Action[] } {
  const byCodename = new Map(guardians.map((g) => [g.codename, g.guardianId]))
  const known = new Set(guardians.map((g) => g.guardianId))
  const glitchById = new Map(glitches.map((g) => [g.glitchId, g]))
  const assignee = new Map<string, string | null>()
  const status = new Map<string, GlitchStatus>()
  const actions: Action[] = []
  const lockdownBreaks: Action[] = []

  type Entry = { t: string; order: string; create?: ProgressGlitch; echo?: ProgressEcho }
  const entries: Entry[] = [
    ...glitches.map((g) => ({ t: g.timestamp, order: `0${g.glitchId}`, create: g })),
    ...echoes.map((e) => ({ t: e.timestamp, order: `1${e.echoId}`, echo: e })),
  ].sort((a, b) => a.t.localeCompare(b.t) || a.order.localeCompare(b.order))

  const idOf = (codename: string | undefined) => (codename ? (byCodename.get(codename) ?? null) : null)
  const lockdownNow = () => isLockdown([...status.values()].map((s) => ({ status: s })))

  for (const entry of entries) {
    if (entry.create) {
      status.set(entry.create.glitchId, 'LEAKED')
      continue
    }
    const e = entry.echo!
    const glitch = glitchById.get(e.glitchId)
    if (!glitch) continue
    const base = { timestamp: e.timestamp, glitchId: e.glitchId, district: glitch.district }

    if (e.kind === 'report') {
      if (known.has(e.reportingGuardianId)) actions.push({ ...base, guardianId: e.reportingGuardianId, kind: 'echo' })
      continue
    }

    // Audit line written by the workflow engine (see workflow-rules.ts for the wording).
    const text = e.description
    const assigned = /(?:assigned to|Reassigned from \S+ to) (\S+) by (\S+)/.exec(text)
    if (assigned) {
      const to = idOf(assigned[1])
      const by = idOf(assigned[2])
      assignee.set(e.glitchId, to)
      if (to) actions.push({ ...base, guardianId: to, kind: 'assigned' })
      if (by) actions.push({ ...base, guardianId: by, kind: 'deploy' })
    } else if (/unassigned by/.test(text)) {
      assignee.set(e.glitchId, null)
    }

    const before = e.statusBefore
    const after = e.statusAfter
    if (!after || before === after) continue
    const lockdownBefore = lockdownNow()
    status.set(e.glitchId, after)
    const owner = assignee.get(e.glitchId) ?? null

    if (after === 'CONTAINING' && owner) actions.push({ ...base, guardianId: owner, kind: 'contain' })
    if (after === 'FIXED') {
      const actor = idOf(/(?:fixed by|override by) (\S+?):?(?:\s|$)/.exec(text)?.[1])
      const fixer = owner ?? actor
      if (fixer) {
        actions.push({ ...base, guardianId: fixer, kind: 'fix' })
        if (glitch.source === 'auto') actions.push({ ...base, guardianId: fixer, kind: 'wild-fix' })
        if (lockdownBefore && !lockdownNow()) lockdownBreaks.push({ ...base, guardianId: fixer, kind: 'fix' })
      }
    }
  }
  return { actions, lockdownBreaks }
}

// ---------- Daily quests ----------

export type QuestDef = {
  id: string
  title: string
  target: number
  reward: number
  /** Which actions count towards it. */
  counts: (a: Action) => boolean
}

/** Local calendar day (YYYY-MM-DD) of a timestamp. */
export function dayKey(time: string | number): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Three quests per day and role, the same for everyone on that date. */
export function dailyQuests(day: string, role: Role): QuestDef[] {
  const rand = seededRandom(hashString(`quests:${day}:${role}`))
  const district = DISTRICTS[Math.floor(rand() * DISTRICTS.length)]
  const pool: QuestDef[] = [
    { id: 'fix-2', title: 'Fix 2 glitches', target: 2, reward: 60, counts: (a) => a.kind === 'fix' },
    {
      id: `echo-${district}`,
      title: `Report an echo in ${DISTRICT_LABELS[district]}`,
      target: 1,
      reward: 30,
      counts: (a) => a.kind === 'echo' && a.district === district,
    },
    { id: 'wild', title: 'Clear a wild spawn', target: 1, reward: 40, counts: (a) => a.kind === 'wild-fix' },
    { id: 'echoes-3', title: 'Report 3 echoes', target: 3, reward: 30, counts: (a) => a.kind === 'echo' },
    ...(role === 'commander'
      ? [{ id: 'deploy-3', title: 'Deploy 3 defenders', target: 3, reward: 45, counts: (a: Action) => a.kind === 'deploy' }]
      : [{ id: 'contain-2', title: 'Push 2 monsters into CONTAINING', target: 2, reward: 40, counts: (a: Action) => a.kind === 'contain' }]),
  ]
  // Deterministic shuffle, then the first three.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export type QuestProgress = { id: string; title: string; target: number; progress: number; reward: number; done: boolean }

// ---------- Achievements ----------

export type AchievementId = 'first-blood' | 'firefighter' | 'cartographer' | 'night-owl' | 'lockdown-breaker'

export const ACHIEVEMENTS: Record<AchievementId, { icon: string; label: string; description: string }> = {
  'first-blood': { icon: '🗡️', label: 'First Blood', description: 'Fix your first glitch' },
  firefighter: { icon: '🧯', label: 'Firefighter', description: 'Fix 3 glitches within 10 minutes' },
  cartographer: { icon: '🗺️', label: 'Cartographer', description: 'Report an echo in every district' },
  'night-owl': { icon: '🦉', label: 'Night Owl', description: 'Report or fix something between midnight and 5 a.m.' },
  'lockdown-breaker': { icon: '🔓', label: 'Lockdown Breaker', description: 'Land the fix that ends a lockdown' },
}

export type Unlocked = { id: AchievementId; unlockedAt: string }

function achievementsFor(mine: Action[], breaks: Action[]): Unlocked[] {
  const out: Unlocked[] = []
  const fixes = mine.filter((a) => a.kind === 'fix')
  if (fixes[0]) out.push({ id: 'first-blood', unlockedAt: fixes[0].timestamp })
  for (let i = 2; i < fixes.length; i++) {
    if (Date.parse(fixes[i].timestamp) - Date.parse(fixes[i - 2].timestamp) <= 10 * 60_000) {
      out.push({ id: 'firefighter', unlockedAt: fixes[i].timestamp })
      break
    }
  }
  const seen = new Set<District>()
  for (const a of mine) {
    if (a.kind !== 'echo') continue
    seen.add(a.district)
    if (seen.size === DISTRICTS.length) {
      out.push({ id: 'cartographer', unlockedAt: a.timestamp })
      break
    }
  }
  const owl = mine.find((a) => (a.kind === 'echo' || a.kind === 'fix') && new Date(a.timestamp).getHours() < 5)
  if (owl) out.push({ id: 'night-owl', unlockedAt: owl.timestamp })
  if (breaks[0]) out.push({ id: 'lockdown-breaker', unlockedAt: breaks[0].timestamp })
  return out.sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt))
}

// ---------- Putting it together ----------

export type PlayerStats = {
  fixed: number
  echoes: number
  contained: number
  deployed: number
  wildFixed: number
  /** Fastest first report → FIXED, in minutes. */
  fastestFixMinutes: number | null
  favoriteDistrict: District | null
}

export type PlayerProgress = ProgressGuardian & {
  xp: number
  level: number
  title: string
  /** XP at the start of this level and needed for the next one. */
  levelFloor: number
  nextLevelAt: number
  stats: PlayerStats
  achievements: Unlocked[]
  quests: QuestProgress[]
  /** Newest first. */
  recent: XpEvent[]
  lastXpAt: string | null
}

const ACTION_XP: Partial<Record<ActionKind, { xp: number; label: string }>> = {
  echo: { xp: XP.echo, label: 'Echo reported' },
  assigned: { xp: XP.assigned, label: 'Glitch assigned to you' },
  contain: { xp: XP.contain, label: 'Moved to CONTAINING' },
  fix: { xp: XP.fix, label: 'Glitch fixed' },
  'wild-fix': { xp: XP.wildFix, label: 'Wild spawn bonus' },
}

export function computeProgress(
  guardians: ProgressGuardian[],
  glitches: ProgressGlitch[],
  echoes: ProgressEcho[],
  now: number = Date.now(),
): PlayerProgress[] {
  const { actions, lockdownBreaks } = deriveActions(guardians, glitches, echoes)
  const created = new Map(glitches.map((g) => [g.glitchId, Date.parse(g.timestamp)]))
  const today = dayKey(now)

  return guardians.map((g) => {
    const mine = actions.filter((a) => a.guardianId === g.guardianId)
    const events: XpEvent[] = []
    for (const a of mine) {
      const rule = ACTION_XP[a.kind]
      if (rule) events.push({ reason: a.kind as XpReason, xp: rule.xp, timestamp: a.timestamp, label: rule.label, glitchId: a.glitchId })
    }

    // Quest rewards, day by day.
    let todaysQuests: QuestProgress[] = []
    const days = new Set(mine.map((a) => dayKey(a.timestamp)))
    days.add(today)
    for (const day of days) {
      const ofDay = mine.filter((a) => dayKey(a.timestamp) === day)
      const quests = dailyQuests(day, g.role).map((q) => {
        const counted = ofDay.filter(q.counts)
        const done = counted.length >= q.target
        if (done) {
          events.push({ reason: 'quest', xp: q.reward, timestamp: counted[q.target - 1].timestamp, label: `Quest: ${q.title}` })
        }
        return { id: q.id, title: q.title, target: q.target, progress: Math.min(q.target, counted.length), reward: q.reward, done }
      })
      if (day === today) todaysQuests = quests
    }

    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const xp = events.reduce((sum, e) => sum + e.xp, 0)
    const level = levelFor(xp)

    const fixes = mine.filter((a) => a.kind === 'fix')
    const durations = fixes
      .map((a) => (Date.parse(a.timestamp) - (created.get(a.glitchId) ?? Date.parse(a.timestamp))) / 60_000)
      .filter((m) => m >= 0)
    const districtCount = new Map<District, number>()
    for (const a of mine) {
      if (a.kind === 'deploy') continue
      districtCount.set(a.district, (districtCount.get(a.district) ?? 0) + 1)
    }
    const favorite = [...districtCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return {
      ...g,
      xp,
      level,
      title: levelTitle(level),
      levelFloor: xpForLevel(level),
      nextLevelAt: xpForLevel(level + 1),
      stats: {
        fixed: fixes.length,
        echoes: mine.filter((a) => a.kind === 'echo').length,
        contained: mine.filter((a) => a.kind === 'contain').length,
        deployed: mine.filter((a) => a.kind === 'deploy').length,
        wildFixed: mine.filter((a) => a.kind === 'wild-fix').length,
        fastestFixMinutes: durations.length ? Math.round(Math.min(...durations)) : null,
        favoriteDistrict: favorite,
      },
      achievements: achievementsFor(mine, lockdownBreaks.filter((b) => b.guardianId === g.guardianId)),
      quests: todaysQuests,
      recent: events.slice(-12).reverse(),
      lastXpAt: events.at(-1)?.timestamp ?? null,
    }
  })
}
