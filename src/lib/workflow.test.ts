// Run with: npm run test:workflow
// 1) Every rule of the workflow, including the refused transitions (pure, no database).
// 2) transitionGlitch() against a throwaway SQLite database (status, assignee, timestamps, audit echo).
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import type { GlitchStatus } from './glitch.ts'
import {
  WorkflowError,
  allowedActions,
  decideTransition,
  type WorkflowActor,
  type WorkflowEvent,
  type WorkflowGlitch,
} from './workflow-rules.ts'

const nova: WorkflowActor = { guardianId: 'GD-01', codename: 'nova', role: 'commander' }
const ember: WorkflowActor = { guardianId: 'GD-02', codename: 'ember', role: 'defender' }
const pixel: WorkflowActor = { guardianId: 'GD-03', codename: 'pixel', role: 'defender' }
const system: WorkflowActor = { guardianId: 'SYSTEM', codename: 'SYSTEM', role: 'system' }

const glitch = (status: GlitchStatus, assignee: WorkflowActor | null = null): WorkflowGlitch => ({
  glitchId: 'GL-0001',
  status,
  assignedGuardianId: assignee?.guardianId ?? null,
  assignedCodename: assignee?.codename ?? null,
})

type Case = {
  name: string
  glitch: WorkflowGlitch
  event: WorkflowEvent
  actor: WorkflowActor
  /** Expected status, `null` for "valid but no change", or a regex for the expected refusal. */
  expect: GlitchStatus | null | RegExp
  assignee?: string | null
}

const cases: Case[] = [
  // ASSIGNED
  { name: 'ASSIGNED on LEAKED → ASSESSING', glitch: glitch('LEAKED'), event: { type: 'ASSIGNED', assignee: ember }, actor: nova, expect: 'ASSESSING', assignee: 'GD-02' },
  { name: 'ASSIGNED by SYSTEM (auto-assign) → ASSESSING', glitch: glitch('LEAKED'), event: { type: 'ASSIGNED', assignee: pixel }, actor: system, expect: 'ASSESSING', assignee: 'GD-03' },
  { name: 'reassign on ASSESSING keeps status', glitch: glitch('ASSESSING', ember), event: { type: 'ASSIGNED', assignee: pixel }, actor: nova, expect: 'ASSESSING', assignee: 'GD-03' },
  { name: 'reassign on CONTAINING keeps status', glitch: glitch('CONTAINING', ember), event: { type: 'ASSIGNED', assignee: pixel }, actor: nova, expect: 'CONTAINING', assignee: 'GD-03' },
  { name: 'REFUSED: defender assigns', glitch: glitch('LEAKED'), event: { type: 'ASSIGNED', assignee: ember }, actor: pixel, expect: /Only a commander/ },
  { name: 'REFUSED: assign to a commander', glitch: glitch('LEAKED'), event: { type: 'ASSIGNED', assignee: nova }, actor: nova, expect: /only be assigned to defenders/ },
  { name: 'REFUSED: assign a FIXED glitch', glitch: glitch('FIXED', ember), event: { type: 'ASSIGNED', assignee: pixel }, actor: nova, expect: /is FIXED/ },
  { name: 'REFUSED: assign to the same defender', glitch: glitch('ASSESSING', ember), event: { type: 'ASSIGNED', assignee: ember }, actor: nova, expect: /already assigned/ },
  // UNASSIGNED
  { name: 'UNASSIGNED on ASSESSING → LEAKED', glitch: glitch('ASSESSING', ember), event: { type: 'UNASSIGNED' }, actor: nova, expect: 'LEAKED', assignee: null },
  { name: 'REFUSED: unassign while CONTAINING', glitch: glitch('CONTAINING', ember), event: { type: 'UNASSIGNED' }, actor: nova, expect: /being contained/ },
  { name: 'REFUSED: unassign when nobody is assigned', glitch: glitch('LEAKED'), event: { type: 'UNASSIGNED' }, actor: nova, expect: /not assigned/ },
  { name: 'REFUSED: defender unassigns', glitch: glitch('ASSESSING', ember), event: { type: 'UNASSIGNED' }, actor: ember, expect: /Only a commander/ },
  // UPDATE_ECHO
  { name: 'UPDATE_ECHO by assignee on ASSESSING → CONTAINING', glitch: glitch('ASSESSING', ember), event: { type: 'UPDATE_ECHO' }, actor: ember, expect: 'CONTAINING' },
  { name: 'UPDATE_ECHO by commander on ASSESSING → CONTAINING', glitch: glitch('ASSESSING', ember), event: { type: 'UPDATE_ECHO' }, actor: nova, expect: 'CONTAINING' },
  { name: 'UPDATE_ECHO by another defender changes nothing', glitch: glitch('ASSESSING', ember), event: { type: 'UPDATE_ECHO' }, actor: pixel, expect: null },
  { name: 'UPDATE_ECHO on LEAKED changes nothing', glitch: glitch('LEAKED'), event: { type: 'UPDATE_ECHO' }, actor: nova, expect: null },
  { name: 'UPDATE_ECHO on CONTAINING changes nothing', glitch: glitch('CONTAINING', ember), event: { type: 'UPDATE_ECHO' }, actor: ember, expect: null },
  // RESOLVED
  { name: 'RESOLVED by assignee on CONTAINING → FIXED', glitch: glitch('CONTAINING', ember), event: { type: 'RESOLVED' }, actor: ember, expect: 'FIXED' },
  { name: 'RESOLVED by commander on CONTAINING → FIXED', glitch: glitch('CONTAINING', ember), event: { type: 'RESOLVED' }, actor: nova, expect: 'FIXED' },
  { name: 'REFUSED: RESOLVED by another defender', glitch: glitch('CONTAINING', ember), event: { type: 'RESOLVED' }, actor: pixel, expect: /Only the assigned defender or a commander/ },
  { name: 'REFUSED: LEAKED → FIXED without override', glitch: glitch('LEAKED'), event: { type: 'RESOLVED' }, actor: nova, expect: /Only CONTAINING glitches/ },
  { name: 'REFUSED: ASSESSING → FIXED', glitch: glitch('ASSESSING', ember), event: { type: 'RESOLVED' }, actor: ember, expect: /Only CONTAINING glitches/ },
  // NEW_ECHO_ON_FIXED
  { name: 'NEW_ECHO_ON_FIXED with assignee → ASSESSING', glitch: glitch('FIXED', ember), event: { type: 'NEW_ECHO_ON_FIXED' }, actor: pixel, expect: 'ASSESSING', assignee: 'GD-02' },
  { name: 'NEW_ECHO_ON_FIXED without assignee → LEAKED', glitch: glitch('FIXED'), event: { type: 'NEW_ECHO_ON_FIXED' }, actor: pixel, expect: 'LEAKED', assignee: null },
  { name: 'NEW_ECHO_ON_FIXED on an open glitch changes nothing', glitch: glitch('CONTAINING', ember), event: { type: 'NEW_ECHO_ON_FIXED' }, actor: pixel, expect: null },
  // MANUAL_OVERRIDE
  { name: 'MANUAL_OVERRIDE LEAKED → FIXED with reason', glitch: glitch('LEAKED'), event: { type: 'MANUAL_OVERRIDE', status: 'FIXED', reason: 'False alarm' }, actor: nova, expect: 'FIXED' },
  { name: 'MANUAL_OVERRIDE FIXED → CONTAINING with reason', glitch: glitch('FIXED', ember), event: { type: 'MANUAL_OVERRIDE', status: 'CONTAINING', reason: 'Relapse' }, actor: nova, expect: 'CONTAINING' },
  { name: 'REFUSED: override without reason', glitch: glitch('LEAKED'), event: { type: 'MANUAL_OVERRIDE', status: 'FIXED', reason: '   ' }, actor: nova, expect: /needs a reason/ },
  { name: 'REFUSED: override by a defender', glitch: glitch('LEAKED'), event: { type: 'MANUAL_OVERRIDE', status: 'FIXED', reason: 'x' }, actor: ember, expect: /Only a commander/ },
  { name: 'REFUSED: override by SYSTEM', glitch: glitch('LEAKED'), event: { type: 'MANUAL_OVERRIDE', status: 'FIXED', reason: 'x' }, actor: system, expect: /Only a commander/ },
  { name: 'REFUSED: override to the same status', glitch: glitch('LEAKED'), event: { type: 'MANUAL_OVERRIDE', status: 'LEAKED', reason: 'x' }, actor: nova, expect: /already LEAKED/ },
]

describe('workflow rules', () => {
  for (const c of cases) {
    test(c.name, () => {
      if (c.expect instanceof RegExp) {
        assert.throws(() => decideTransition(c.glitch, c.event, c.actor), (err: unknown) => {
          assert.ok(err instanceof WorkflowError, 'expected a WorkflowError')
          assert.match(err.message, c.expect as RegExp)
          return true
        })
        return
      }
      const result = decideTransition(c.glitch, c.event, c.actor)
      if (c.expect === null) {
        assert.equal(result, null)
        return
      }
      assert.ok(result, 'expected a transition')
      assert.equal(result.from, c.glitch.status)
      assert.equal(result.to, c.expect)
      assert.ok(result.summary.length > 0)
      if (c.assignee !== undefined) assert.equal(result.assignedGuardianId, c.assignee)
    })
  }

  test('allowedActions only offers valid buttons', () => {
    assert.deepEqual(
      { ...allowedActions(glitch('LEAKED'), nova), hint: '' },
      { assign: true, unassign: false, resolve: false, override: true, hint: '' },
    )
    assert.equal(allowedActions(glitch('ASSESSING', ember), nova).unassign, true)
    assert.equal(allowedActions(glitch('CONTAINING', ember), ember).resolve, true)
    assert.equal(allowedActions(glitch('CONTAINING', ember), pixel).resolve, false)
    assert.equal(allowedActions(glitch('FIXED', ember), nova).assign, false)
    assert.equal(allowedActions(glitch('LEAKED'), ember).override, false)
  })
})

describe('transitionGlitch on a real database', async () => {
  const projectRoot = path.resolve(import.meta.dirname, '../..')
  const dbFile = path.join(tmpdir(), `gotg-workflow-test-${process.pid}.db`)
  process.env.DB_FILE_NAME = dbFile
  execSync('npx drizzle-kit push', { cwd: projectRoot, env: { ...process.env, DB_FILE_NAME: dbFile }, stdio: 'ignore' })
  await import('../db/seed.ts')
  const { db } = await import('../db/index.ts')
  const { echoes, glitches } = await import('../db/schema.ts')
  const { eq, desc } = await import('drizzle-orm')
  const { transitionGlitch } = await import('./workflow.ts')

  after(() => {
    db.$client.close()
    for (const suffix of ['', '-wal', '-shm']) rmSync(dbFile + suffix, { force: true })
  })

  const statusOf = (id: string) => db.select().from(glitches).where(eq(glitches.glitchId, id)).get()!
  const lastEcho = (id: string) =>
    db.select().from(echoes).where(eq(echoes.glitchId, id)).orderBy(desc(echoes.echoId)).limit(1).get()!

  test('full lifecycle with audit echoes', () => {
    const before = statusOf('GL-0142')
    assert.equal(before.status, 'LEAKED')

    const assigned = transitionGlitch('GL-0142', { type: 'ASSIGNED', assignee: ember }, nova)
    assert.equal(assigned.status, 'ASSESSING')
    const row = statusOf('GL-0142')
    assert.equal(row.assignedGuardianId, 'GD-02')
    assert.ok(row.statusChangedAt > before.statusChangedAt, 'status_changed_at is updated')
    const log = lastEcho('GL-0142')
    assert.equal(log.reportingGuardianId, 'SYSTEM')
    assert.equal(log.kind, 'audit')
    assert.equal(log.statusBefore, 'LEAKED')
    assert.equal(log.statusAfter, 'ASSESSING')
    assert.equal(log.description, 'Status LEAKED → ASSESSING: assigned to ember by nova')

    assert.equal(transitionGlitch('GL-0142', { type: 'UPDATE_ECHO' }, pixel).transition, null, 'other defender: no change')
    assert.equal(transitionGlitch('GL-0142', { type: 'UPDATE_ECHO' }, ember).status, 'CONTAINING')
    assert.throws(() => transitionGlitch('GL-0142', { type: 'RESOLVED' }, pixel), WorkflowError)
    assert.equal(statusOf('GL-0142').status, 'CONTAINING', 'refused transition changes nothing')
    assert.equal(transitionGlitch('GL-0142', { type: 'RESOLVED' }, ember).status, 'FIXED')
    assert.equal(transitionGlitch('GL-0142', { type: 'NEW_ECHO_ON_FIXED' }, pixel).status, 'ASSESSING')
    assert.equal(
      transitionGlitch('GL-0142', { type: 'MANUAL_OVERRIDE', status: 'FIXED', reason: 'Loop closed by the archmage' }, nova).status,
      'FIXED',
    )
    assert.match(lastEcho('GL-0142').description, /Reason: Loop closed by the archmage/)
  })

  test('unknown glitch is refused', () => {
    assert.throws(() => transitionGlitch('GL-9999', { type: 'RESOLVED' }, nova), /does not exist/)
  })
})
