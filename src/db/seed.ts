import { db } from './index.ts'
import { echoes, glitches, guardians } from './schema.ts'
import { hashPassword } from '../lib/password.ts'

// Timestamps are relative to "now", so the demo data is always recent.
const now = Date.now()
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

const guardianRows: (typeof guardians.$inferInsert)[] = [
  { guardianId: 'GD-01', codename: 'nova', role: 'commander', passwordHash: hashPassword('commander123') },
  { guardianId: 'GD-02', codename: 'ember', role: 'defender', passwordHash: hashPassword('defender123') },
  { guardianId: 'GD-03', codename: 'pixel', role: 'defender', passwordHash: hashPassword('defender123') },
]

const glitchRows: (typeof glitches.$inferInsert)[] = [
  { glitchId: 'GL-0142', status: 'LEAKED', district: 'clocktower', description: 'Time loop detected near the eastern clock tower', timestamp: minutesAgo(12), assignedGuardianId: null },
  { glitchId: 'GL-0141', status: 'ASSESSING', district: 'skyforge', description: 'Magic reserves dropping faster than expected', timestamp: minutesAgo(48), assignedGuardianId: 'GD-02' },
  { glitchId: 'GL-0139', status: 'CONTAINING', district: 'archives', description: 'Portal flicker in the archive vaults', timestamp: minutesAgo(95), assignedGuardianId: 'GD-03' },
  { glitchId: 'GL-0137', status: 'FIXED', district: 'harbor', description: 'Echo sensors reporting duplicate signals', timestamp: minutesAgo(180), assignedGuardianId: 'GD-02' },
]

const echoRows: (typeof echoes.$inferInsert)[] = [
  { echoId: 'EC-0001', glitchId: 'GL-0137', district: 'harbor', reportingGuardianId: 'GD-03', timestamp: minutesAgo(180), description: 'Sensor array at the harbor shows every signal twice.' },
  { echoId: 'EC-0002', glitchId: 'GL-0137', district: 'harbor', reportingGuardianId: 'GD-02', timestamp: minutesAgo(130), description: 'Recalibrated the relay. Duplicates have stopped.' },
  { echoId: 'EC-0003', glitchId: 'GL-0139', district: 'archives', reportingGuardianId: 'GD-02', timestamp: minutesAgo(95), description: 'Archive vault portal flickers every few seconds.' },
  { echoId: 'EC-0004', glitchId: 'GL-0139', district: 'archives', reportingGuardianId: 'GD-03', timestamp: minutesAgo(70), description: 'Seal runes placed around the portal frame, flicker slowing down.' },
  { echoId: 'EC-0005', glitchId: 'GL-0139', district: 'archives', reportingGuardianId: 'GD-01', timestamp: minutesAgo(55), description: 'Containment holding. Keep the vault closed until further notice.' },
  { echoId: 'EC-0006', glitchId: 'GL-0141', district: 'skyforge', reportingGuardianId: 'GD-03', timestamp: minutesAgo(48), description: 'Reserve meter fell 12% within the last hour.' },
  { echoId: 'EC-0007', glitchId: 'GL-0141', district: 'skyforge', reportingGuardianId: 'GD-02', timestamp: minutesAgo(30), description: 'Drain seems to come from the northern ley line.' },
  { echoId: 'EC-0008', glitchId: 'GL-0142', district: 'clocktower', reportingGuardianId: 'GD-02', timestamp: minutesAgo(12), description: 'Citizens near the clock tower keep reliving the same minute.' },
]

// Wipe and refill so the seed can be re-run safely. Children first, because of foreign keys.
db.transaction((tx) => {
  tx.delete(echoes).run()
  tx.delete(glitches).run()
  tx.delete(guardians).run()
  tx.insert(guardians).values(guardianRows).run()
  tx.insert(glitches).values(glitchRows).run()
  tx.insert(echoes).values(echoRows).run()
})

console.log(
  `Seeded ${guardianRows.length} guardians, ${glitchRows.length} glitches and ${echoRows.length} echoes.`,
)
