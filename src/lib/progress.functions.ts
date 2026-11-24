import { createServerFn } from '@tanstack/react-start'
import { asc, ne } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { echoes, glitches, guardians } from '#/db/schema.ts'
import { computeProgress, type PlayerProgress } from '#/lib/progress.ts'
import { requireGuardian } from '#/lib/session.ts'

/** XP, level, quests and achievements of every guardian (derived from echoes + audit log). */
export const getProgress = createServerFn({ method: 'GET' }).handler(async (): Promise<PlayerProgress[]> => {
  requireGuardian()
  const players = db
    .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
    .from(guardians)
    .where(ne(guardians.role, 'system'))
    .orderBy(asc(guardians.codename))
    .all()
  const allGlitches = db
    .select({ glitchId: glitches.glitchId, district: glitches.district, source: glitches.source, timestamp: glitches.timestamp })
    .from(glitches)
    .all()
  const allEchoes = db
    .select({
      echoId: echoes.echoId,
      glitchId: echoes.glitchId,
      district: echoes.district,
      timestamp: echoes.timestamp,
      reportingGuardianId: echoes.reportingGuardianId,
      kind: echoes.kind,
      description: echoes.description,
      statusBefore: echoes.statusBefore,
      statusAfter: echoes.statusAfter,
    })
    .from(echoes)
    .orderBy(asc(echoes.timestamp), asc(echoes.echoId))
    .all()
  return computeProgress(players, allGlitches, allEchoes)
})
