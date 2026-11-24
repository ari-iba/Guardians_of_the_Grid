import { db } from './index.ts'
import { echoes, glitches, guardians } from './schema.ts'
import { hashPassword } from '../lib/password.ts'

const guardianRows: (typeof guardians.$inferInsert)[] = [
  { guardianId: 'GD-01', codename: 'nova', role: 'commander', passwordHash: hashPassword('commander123') },
  { guardianId: 'GD-02', codename: 'ember', role: 'defender', passwordHash: hashPassword('defender123') },
  { guardianId: 'GD-03', codename: 'pixel', role: 'defender', passwordHash: hashPassword('defender123') },
]

const glitchRows: (typeof glitches.$inferInsert)[] = [
  { glitchId: 'GL-0142', status: 'LEAKED', description: 'Time loop detected near the eastern clock tower', timestamp: '2026-11-10T13:42:00Z', assignedGuardianId: null },
  { glitchId: 'GL-0141', status: 'ASSESSING', description: 'Magic reserves dropping faster than expected', timestamp: '2026-11-10T11:05:00Z', assignedGuardianId: 'GD-02' },
  { glitchId: 'GL-0139', status: 'CONTAINING', description: 'Portal flicker in the archive vaults', timestamp: '2026-11-09T22:17:00Z', assignedGuardianId: 'GD-03' },
  { glitchId: 'GL-0137', status: 'FIXED', description: 'Echo sensors reporting duplicate signals', timestamp: '2026-11-08T08:30:00Z', assignedGuardianId: 'GD-02' },
]

const echoRows: (typeof echoes.$inferInsert)[] = [
  { echoId: 'EC-0001', glitchId: 'GL-0137', reportingGuardianId: 'GD-03', timestamp: '2026-11-08T08:30:00Z', description: 'Sensor array in sector 7 shows every signal twice.' },
  { echoId: 'EC-0002', glitchId: 'GL-0137', reportingGuardianId: 'GD-02', timestamp: '2026-11-08T10:12:00Z', description: 'Recalibrated the relay. Duplicates have stopped.' },
  { echoId: 'EC-0003', glitchId: 'GL-0139', reportingGuardianId: 'GD-02', timestamp: '2026-11-09T22:17:00Z', description: 'Archive vault portal flickers every few seconds.' },
  { echoId: 'EC-0004', glitchId: 'GL-0139', reportingGuardianId: 'GD-03', timestamp: '2026-11-10T06:40:00Z', description: 'Seal runes placed around the portal frame, flicker slowing down.' },
  { echoId: 'EC-0005', glitchId: 'GL-0139', reportingGuardianId: 'GD-01', timestamp: '2026-11-10T09:02:00Z', description: 'Containment holding. Keep the vault closed until further notice.' },
  { echoId: 'EC-0006', glitchId: 'GL-0141', reportingGuardianId: 'GD-03', timestamp: '2026-11-10T11:05:00Z', description: 'Reserve meter fell 12% within the last hour.' },
  { echoId: 'EC-0007', glitchId: 'GL-0141', reportingGuardianId: 'GD-02', timestamp: '2026-11-10T12:20:00Z', description: 'Drain seems to come from the northern ley line.' },
  { echoId: 'EC-0008', glitchId: 'GL-0142', reportingGuardianId: 'GD-02', timestamp: '2026-11-10T13:42:00Z', description: 'Citizens near the clock tower keep reliving the same minute.' },
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
