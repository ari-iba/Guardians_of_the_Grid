// Server-only: signed session cookie + permission guards.
//
// The installed TanStack Start version no longer ships `useSession`, so the session is
// a small HMAC-signed cookie built on node:crypto. It only stores the guardian id and
// an expiry; the role is always looked up fresh from the database.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { db } from '#/db/index.ts'
import { guardians } from '#/db/schema.ts'
import type { Guardian } from '#/lib/guardian.ts'

const COOKIE_NAME = 'gotg_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // one week
const DEV_SECRET = 'dev-only-insecure-session-secret-change-me-please!!'

let cachedSecret: string | undefined

function sessionSecret(): string {
  if (cachedSecret) return cachedSecret
  if (!process.env.SESSION_SECRET) {
    // Node 22 can read .env without a dependency; a missing file is fine.
    try {
      process.loadEnvFile()
    } catch {
      /* no .env */
    }
  }
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    cachedSecret = secret
  } else {
    console.warn(
      '\n⚠️  SESSION_SECRET is missing or shorter than 32 characters.\n' +
        '   Falling back to an INSECURE development secret. Set SESSION_SECRET in .env (see .env.example).\n',
    )
    cachedSecret = DEV_SECRET
  }
  return cachedSecret
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

/** Starts a session for this guardian (sets the cookie). */
export function startSession(guardianId: string): void {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = `${guardianId}.${expires}`
  setCookie(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export function endSession(): void {
  deleteCookie(COOKIE_NAME, { path: '/' })
}

/** The guardian id from a valid, unexpired cookie, or null. */
function sessionGuardianId(): string | null {
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [guardianId, expires, signature] = parts
  const expected = Buffer.from(sign(`${guardianId}.${expires}`))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  if (Number(expires) < Date.now()) return null
  return guardianId
}

/** The logged-in guardian, or null. Never includes the password hash. */
export function currentGuardian(): Guardian | null {
  const guardianId = sessionGuardianId()
  if (!guardianId) return null
  const row = db
    .select({
      guardianId: guardians.guardianId,
      codename: guardians.codename,
      role: guardians.role,
    })
    .from(guardians)
    .where(eq(guardians.guardianId, guardianId))
    .get()
  return row ?? null
}

/** Throws unless someone is logged in. */
export function requireGuardian(): Guardian {
  const guardian = currentGuardian()
  if (!guardian) throw new Error('You need to log in first.')
  return guardian
}

/** Throws unless a commander is logged in. */
export function requireCommander(): Guardian {
  const guardian = requireGuardian()
  if (guardian.role !== 'commander') {
    throw new Error('Only a commander can do this.')
  }
  return guardian
}
