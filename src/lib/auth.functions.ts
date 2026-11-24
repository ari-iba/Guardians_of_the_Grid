import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index.ts'
import { guardians } from '#/db/schema.ts'
import type { Guardian } from '#/lib/guardian.ts'
import { hashPassword, verifyPassword } from '#/lib/password.ts'
import { currentGuardian, endSession, startSession } from '#/lib/session.ts'

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
    if (!row) {
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
