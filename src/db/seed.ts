import { db } from './index.ts'
import { echoes, glitches, guardians, sensorReadings, settings } from './schema.ts'
import { DISTRICTS } from '../lib/district.ts'
import { hashPassword } from '../lib/password.ts'
import { METRICS, NORMAL_LEVEL } from '../lib/sensors.ts'

// Timestamps are relative to "now", so the demo data is always recent.
const now = Date.now()
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

const guardianRows: (typeof guardians.$inferInsert)[] = [
  // SYSTEM writes audit logs and auto-detections. '!' is not a valid hash, so it can never log in.
  { guardianId: 'SYSTEM', codename: 'SYSTEM', role: 'system', passwordHash: '!' },
  { guardianId: 'GD-01', codename: 'nova', role: 'commander', passwordHash: hashPassword('commander123') },
  { guardianId: 'GD-02', codename: 'ember', role: 'defender', passwordHash: hashPassword('defender123') },
  { guardianId: 'GD-03', codename: 'pixel', role: 'defender', passwordHash: hashPassword('defender123') },
]

const glitchRows: (typeof glitches.$inferInsert)[] = [
  { glitchId: 'GL-0142', status: 'LEAKED', district: 'clocktower', description: 'Time loop detected near the eastern clock tower', timestamp: minutesAgo(12), statusChangedAt: minutesAgo(12), assignedGuardianId: null },
  { glitchId: 'GL-0141', status: 'ASSESSING', district: 'skyforge', description: 'Magic reserves dropping faster than expected', timestamp: minutesAgo(48), statusChangedAt: minutesAgo(45), assignedGuardianId: 'GD-02' },
  { glitchId: 'GL-0139', status: 'CONTAINING', district: 'archives', description: 'Portal flicker in the archive vaults', timestamp: minutesAgo(95), statusChangedAt: minutesAgo(70), assignedGuardianId: 'GD-03' },
  { glitchId: 'GL-0137', status: 'FIXED', district: 'harbor', description: 'Echo sensors reporting duplicate signals', timestamp: minutesAgo(180), statusChangedAt: minutesAgo(130), assignedGuardianId: 'GD-02' },
]

type EchoSeed = Omit<typeof echoes.$inferInsert, 'echoId'>
const report = (glitchId: string, district: EchoSeed['district'], by: string, m: number, description: string): EchoSeed =>
  ({ glitchId, district, reportingGuardianId: by, timestamp: minutesAgo(m), description, kind: 'report' })
const audit = (glitchId: string, district: EchoSeed['district'], m: number, before: EchoSeed['statusBefore'], after: EchoSeed['statusAfter'], description: string): EchoSeed =>
  ({ glitchId, district, reportingGuardianId: 'SYSTEM', timestamp: minutesAgo(m), description, kind: 'audit', statusBefore: before, statusAfter: after })

const echoSeeds: EchoSeed[] = [
  report('GL-0137', 'harbor', 'GD-03', 180, 'Sensor array at the harbor shows every signal twice.'),
  audit('GL-0137', 'harbor', 170, 'LEAKED', 'ASSESSING', 'Status LEAKED → ASSESSING: assigned to ember by nova'),
  report('GL-0137', 'harbor', 'GD-02', 150, 'Isolated the faulty relay, rerouting the signal.'),
  audit('GL-0137', 'harbor', 150, 'ASSESSING', 'CONTAINING', 'Status ASSESSING → CONTAINING: update from ember'),
  report('GL-0137', 'harbor', 'GD-02', 130, 'Recalibrated the relay. Duplicates have stopped.'),
  audit('GL-0137', 'harbor', 130, 'CONTAINING', 'FIXED', 'Status CONTAINING → FIXED: marked as fixed by ember'),
  report('GL-0139', 'archives', 'GD-02', 95, 'Archive vault portal flickers every few seconds.'),
  audit('GL-0139', 'archives', 90, 'LEAKED', 'ASSESSING', 'Status LEAKED → ASSESSING: assigned to pixel by nova'),
  report('GL-0139', 'archives', 'GD-03', 70, 'Seal runes placed around the portal frame, flicker slowing down.'),
  audit('GL-0139', 'archives', 70, 'ASSESSING', 'CONTAINING', 'Status ASSESSING → CONTAINING: update from pixel'),
  report('GL-0139', 'archives', 'GD-01', 55, 'Containment holding. Keep the vault closed until further notice.'),
  report('GL-0141', 'skyforge', 'GD-03', 48, 'Reserve meter fell 12% within the last hour.'),
  audit('GL-0141', 'skyforge', 45, 'LEAKED', 'ASSESSING', 'Status LEAKED → ASSESSING: assigned to ember by nova'),
  report('GL-0141', 'skyforge', 'GD-03', 30, 'Drain seems to come from the northern ley line.'),
  report('GL-0142', 'clocktower', 'GD-02', 12, 'Citizens near the clock tower keep reliving the same minute.'),
]

// Ids follow chronological order, like they would in real use.
const echoRows: (typeof echoes.$inferInsert)[] = echoSeeds
  .map((e, i) => ({ e, i }))
  .sort((a, b) => a.e.timestamp.localeCompare(b.e.timestamp) || a.i - b.i)
  .map(({ e }, n) => ({ ...e, echoId: `EC-${String(n + 1).padStart(4, '0')}` }))

// Five minutes of healthy sensor history (one reading per 5 s) for every district + metric.
const readingRows: (typeof sensorReadings.$inferInsert)[] = []
for (const district of DISTRICTS) {
  for (const metric of METRICS) {
    let value = NORMAL_LEVEL[metric]
    for (let i = 59; i >= 0; i--) {
      value = Math.max(0, Math.min(100, value + (NORMAL_LEVEL[metric] - value) * 0.12 + (Math.random() - 0.5) * 5))
      readingRows.push({ district, metric, value: Math.round(value * 10) / 10, timestamp: new Date(now - i * 5000).toISOString() })
    }
  }
}

const settingRows: (typeof settings.$inferInsert)[] = [
  { key: 'autoDesync', value: 'true' },
  { key: 'autoAssign', value: 'false' },
  { key: 'attacks', value: '{}' },
]

// Wipe and refill so the seed can be re-run safely. Children first, because of foreign keys.
db.transaction((tx) => {
  tx.delete(sensorReadings).run()
  tx.delete(settings).run()
  tx.delete(echoes).run()
  tx.delete(glitches).run()
  tx.delete(guardians).run()
  tx.insert(guardians).values(guardianRows).run()
  tx.insert(glitches).values(glitchRows).run()
  tx.insert(echoes).values(echoRows).run()
  tx.insert(sensorReadings).values(readingRows).run()
  tx.insert(settings).values(settingRows).run()
})

console.log(
  `Seeded ${guardianRows.length} guardians (incl. SYSTEM), ${glitchRows.length} glitches, ${echoRows.length} echoes and ${readingRows.length} sensor readings.`,
)
