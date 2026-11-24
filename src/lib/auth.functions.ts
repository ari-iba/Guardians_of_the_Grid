import { createServerFn } from '@tanstack/react-start'
import { asc, eq, ne } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { guardians } from '#/db/schema.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { hashPassword, verifyPassword } from '#/lib/password.ts'
import { currentGuardian, endSession, requireGuardian, startSession } from '#/lib/session.ts'

export type LoginResult = { ok: true; guardian: Guardian } | { ok: false; error: string }

const INVALID = 'Unknown codename or wrong password.'
let dummyHash: string | undefined

export const login = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { codename, password } = (input ?? {}) as Record<string, unknown>
    if (typeof codename !== 'string' || typeof password !== 'string') {
      throw new Error('Codename and password are required.')
    }
    return { codename: codename.trim().toLowerCase().slice(0, 64), password: password.slice(0, 256) }
  })
  .handler(async ({ data }): Promise<LoginResult> => {
    if (!data.codename || !data.password) {
      return { ok: false, error: 'Enter your codename and password.' }
    }
    const row = db.select().from(guardians).where(eq(guardians.codename, data.codename)).get()
    if (!row || row.role === 'system') {
      // Spend the same time hashing so response time doesn't reveal which codenames exist.
      verifyPassword(data.password, (dummyHash ??= hashPassword('dummy')))
      return { ok: false, error: INVALID }
    }
    if (!verifyPassword(data.password, row.passwordHash)) {
      return { ok: false, error: INVALID }
    }
    startSession(row.guardianId)
    return { ok: true, guardian: { guardianId: row.guardianId, codename: row.codename, role: row.role } }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  endSession()
  return { ok: true }
})

export const getCurrentGuardian = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Guardian | null> => currentGuardian(),
)

// ---------- Demo mode: switch guardian without a password ----------

/**
 * Demo mode (guardian switcher). DEMO_MODE=true/false in .env decides; without it, it is on
 * during development and off in production builds. `import.meta.env.DEV` is fixed at build
 * time, so a production build can never fall back to demo mode by accident.
 */
function demoMode(): boolean {
  const flag = process.env.DEMO_MODE
  if (flag === 'true') return true
  if (flag === 'false') return false
  return import.meta.env.DEV
}

/** Guardians you can switch to (everyone except SYSTEM), or null when demo mode is off. */
export const getDemoGuardians = createServerFn({ method: 'GET' }).handler(async (): Promise<Guardian[] | null> => {
  requireGuardian()
  if (!demoMode()) return null
  return db
    .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
    .from(guardians)
    .where(ne(guardians.role, 'system'))
    .orderBy(asc(guardians.role), asc(guardians.codename))
    .all()
})

/**
 * Demo mode only: act as another guardian. It just puts that guardian id in the session,
 * so every existing role check on the server keeps working unchanged.
 */
export const switchGuardian = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { guardianId } = (input ?? {}) as Record<string, unknown>
    if (typeof guardianId !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(guardianId)) throw new Error('Invalid guardian.')
    return { guardianId }
  })
  .handler(async ({ data }): Promise<Guardian> => {
    if (!demoMode()) throw new Error('The guardian switcher only works in demo mode (DEMO_MODE=true).')
    requireGuardian()
    const row = db
      .select({ guardianId: guardians.guardianId, codename: guardians.codename, role: guardians.role })
      .from(guardians)
      .where(eq(guardians.guardianId, data.guardianId))
      .get()
    if (!row || row.role === 'system') throw new Error('That guardian does not exist.')
    startSession(row.guardianId)
    return row
  })
