// Auth for both namespaces. Mobile = constant-time x-http-key. Web = HMAC-signed httpOnly cookie session.
// Dependency-free (node:crypto). See ARCHITECTURE.md §1.
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

// ─────────────────────────── mobile: x-http-key ───────────────────────────

/** Constant-time compare that never short-circuits on length. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Still do a compare against self to keep timing roughly constant, then fail.
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Verify the mobile x-http-key against the configured key and resolve the single User.
 * Throws AuthError(401) on a missing/incorrect key — NO silent provisioning (closes AUDIT §3.2).
 */
export async function requireMobileUser(req: NextRequest) {
  const key = req.headers.get('x-http-key')
  if (!key) throw new AuthError(401, 'Missing x-http-key')
  if (!safeEqual(key, env.mobileHttpKey())) throw new AuthError(401, 'Invalid x-http-key')

  const user = await prisma.user.findUnique({ where: { xHttpKey: key } })
  if (!user) throw new AuthError(401, 'Unknown device key')
  return user
}

// ─────────────────────────── web: password + session ───────────────────────────

const SCRYPT_KEYLEN = 64

/** Format: scrypt:<saltHex>:<hashHex>. Colon delimiter avoids `$` env-expansion in .env files. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(':')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const SESSION_COOKIE = 'mv_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

type SessionPayload = { userId: string; exp: number }

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Signed session token: <payloadB64url>.<hmacB64url>. */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId, exp: Date.now() + SESSION_TTL_MS }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = b64url(createHmac('sha256', env.sessionSecret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = b64url(createHmac('sha256', env.sessionSecret()).update(body).digest())
  if (!safeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
}

/** Resolve the web session user from the request cookie, or throw AuthError(401). */
export async function requireWebUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const payload = verifySessionToken(token)
  if (!payload) throw new AuthError(401, 'Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw new AuthError(401, 'Session user not found')
  return user
}
