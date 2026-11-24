import { createServerFn } from '@tanstack/react-start'
import { desc } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { glitches } from '#/db/schema.ts'
import type { Glitch } from '#/lib/glitch.ts'
import { requireGuardian } from '#/lib/session.ts'

export const getGlitches = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Glitch[]> => {
    requireGuardian()
    return db.select().from(glitches).orderBy(desc(glitches.timestamp)).all()
  },
)
