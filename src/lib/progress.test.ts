// Run with: npm run test:workflow (runs together with the workflow tests)
// XP, levels, quests and achievements are derived from the audit log the workflow writes.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  XP,
  computeProgress,
  dailyQuests,
  levelFor,
  xpForLevel,
  type ProgressEcho,
  type ProgressGlitch,
  type ProgressGuardian,
} from './progress.ts'
import { bossOf, monsterName, monsterTraits } from './monster.ts'

const guardians: ProgressGuardian[] = [
  { guardianId: 'GD-01', codename: 'nova', role: 'commander' },
  { guardianId: 'GD-02', codename: 'ember', role: 'defender' },
]

// Noon today, so "today" quests and the Night Owl rule are predictable.
const base = new Date()
base.setHours(12, 0, 0, 0)
const at = (min: number) => new Date(base.getTime() + min * 60_000).toISOString()

let n = 0
const report = (glitchId: string, by: string, min: number, district: ProgressEcho['district'] = 'harbor'): ProgressEcho => ({
  echoId: `EC-${String(++n).padStart(4, '0')}`,
  glitchId,
  district,
  timestamp: at(min),
  reportingGuardianId: by,
  kind: 'report',
  description: 'seen something',
  statusBefore: null,
  statusAfter: null,
})
const audit = (glitchId: string, min: number, before: ProgressEcho['statusBefore'], after: ProgressEcho['statusAfter'], description: string): ProgressEcho => ({
  echoId: `EC-${String(++n).padStart(4, '0')}`,
  glitchId,
  district: 'harbor',
  timestamp: at(min),
  reportingGuardianId: 'SYSTEM',
  kind: 'audit',
  description,
  statusBefore: before,
  statusAfter: after,
})

/** A full lifecycle for one glitch, worked by ember and deployed by nova. */
function lifecycle(glitchId: string, start: number, source: 'manual' | 'auto' = 'manual') {
  const glitch: ProgressGlitch = { glitchId, district: 'harbor', source, timestamp: at(start) }
  const echoes = [
    report(glitchId, 'GD-02', start),
    audit(glitchId, start + 1, 'LEAKED', 'ASSESSING', 'Status LEAKED → ASSESSING: assigned to ember by nova'),
    report(glitchId, 'GD-02', start + 2),
    audit(glitchId, start + 2, 'ASSESSING', 'CONTAINING', 'Status ASSESSING → CONTAINING: update from ember'),
    audit(glitchId, start + 3, 'CONTAINING', 'FIXED', 'Status CONTAINING → FIXED: marked as fixed by ember'),
  ]
  return { glitch, echoes }
}

describe('levels', () => {
  test('thresholds grow', () => {
    assert.equal(xpForLevel(1), 0)
    assert.equal(xpForLevel(2), 100)
    assert.equal(xpForLevel(4), 600)
    assert.equal(levelFor(0), 1)
    assert.equal(levelFor(99), 1)
    assert.equal(levelFor(100), 2)
    assert.equal(levelFor(650), 4)
  })
})

describe('XP from the audit log', () => {
  test('echo +10, assigned +5, containing +15, fixed +50', () => {
    const { glitch, echoes } = lifecycle('GL-0001', 0)
    const [nova, ember] = computeProgress(guardians, [glitch], echoes, base.getTime())
    const questXp = ember.recent.filter((e) => e.reason === 'quest').reduce((s, e) => s + e.xp, 0)
    assert.equal(ember.xp - questXp, 2 * XP.echo + XP.assigned + XP.contain + XP.fix)
    assert.equal(ember.stats.fixed, 1)
    assert.equal(ember.stats.echoes, 2)
    assert.equal(ember.stats.fastestFixMinutes, 3)
    assert.equal(nova.stats.deployed, 1)
    assert.ok(ember.achievements.some((a) => a.id === 'first-blood'))
  })

  test('a wild spawn (auto glitch) gives a +25 bonus', () => {
    const manual = lifecycle('GL-0001', 0)
    const auto = lifecycle('GL-0002', 10, 'auto')
    const ember1 = computeProgress(guardians, [manual.glitch], manual.echoes, base.getTime())[1]
    const bonus = computeProgress(guardians, [auto.glitch], auto.echoes, base.getTime())[1]
    assert.ok(bonus.recent.some((e) => e.reason === 'wild-fix' && e.xp === XP.wildFix))
    assert.equal(bonus.stats.wildFixed, 1)
    assert.equal(ember1.stats.wildFixed, 0)
  })

  test('3 fixes within 10 minutes unlocks Firefighter', () => {
    const runs = [lifecycle('GL-0001', 0), lifecycle('GL-0002', 1), lifecycle('GL-0003', 2)]
    const ember = computeProgress(
      guardians,
      runs.map((r) => r.glitch),
      runs.flatMap((r) => r.echoes),
      base.getTime(),
    )[1]
    assert.ok(ember.achievements.some((a) => a.id === 'firefighter'))
    assert.ok(!ember.achievements.some((a) => a.id === 'lockdown-breaker'))
  })

  test('the fix that ends a lockdown unlocks Lockdown Breaker', () => {
    // Five LEAKED glitches = lockdown. The third fix brings it down to 2 LEAKED / 70% magic.
    const ids = ['GL-0001', 'GL-0002', 'GL-0003', 'GL-0004', 'GL-0005']
    const glitches: ProgressGlitch[] = ids.map((glitchId) => ({ glitchId, district: 'harbor', source: 'manual', timestamp: at(0) }))
    const echoes = ids.slice(0, 3).map((id, i) => audit(id, 1 + i, 'LEAKED', 'FIXED', 'Manual override by nova: LEAKED → FIXED. Reason: test'))
    const [nova] = computeProgress(guardians, glitches, echoes, base.getTime())
    const breaker = nova.achievements.find((a) => a.id === 'lockdown-breaker')
    assert.equal(breaker?.unlockedAt, at(3))
  })

  test('a commander fixing an unassigned glitch through an override gets the fix', () => {
    const glitch: ProgressGlitch = { glitchId: 'GL-0009', district: 'skyforge', source: 'manual', timestamp: at(0) }
    const echoes = [
      report('GL-0009', 'GD-02', 0, 'skyforge'),
      audit('GL-0009', 1, 'LEAKED', 'FIXED', 'Manual override by nova: LEAKED → FIXED. Reason: false alarm'),
    ]
    const [nova] = computeProgress(guardians, [glitch], echoes, base.getTime())
    assert.equal(nova.stats.fixed, 1)
  })
})

describe('daily quests', () => {
  test('three per day, deterministic for the date', () => {
    const a = dailyQuests('2026-11-24', 'defender').map((q) => q.id)
    const b = dailyQuests('2026-11-24', 'defender').map((q) => q.id)
    assert.equal(a.length, 3)
    assert.deepEqual(a, b)
    assert.ok(!dailyQuests('2026-11-24', 'defender').some((q) => q.id === 'deploy-3'))
  })
})

describe('monsters', () => {
  test('same glitch → same monster and name', () => {
    const g = { glitchId: 'GL-0142', district: 'clocktower' as const, metric: 'magic' as const }
    assert.deepEqual(monsterTraits(g), monsterTraits(g))
    assert.equal(monsterName(g), 'Clockwork Wraith')
  })

  test('the boss is the open glitch with the most HP left', () => {
    const boss = bossOf([
      { glitchId: 'A', status: 'CONTAINING' as const, echoCount: 9, timestamp: at(0) },
      { glitchId: 'B', status: 'LEAKED' as const, echoCount: 1, timestamp: at(1) },
      { glitchId: 'C', status: 'FIXED' as const, echoCount: 20, timestamp: at(2) },
    ])
    assert.equal(boss?.glitchId, 'B')
  })
})
