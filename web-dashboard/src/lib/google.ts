// Google Calendar integration (ARCHITECTURE §6). Server-side OAuth; tokens encrypted at rest with
// TOKEN_ENC_KEY. Tasks (custom + fixed) become timed Calendar events; alerts are excluded.
// Fetch-based (no SDK). Not runtime-verified here (needs GOOGLE_* creds) — build-verified.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

// ── token encryption (AES-256-GCM) ────────────────────────────
function keyBuf(): Buffer {
  const k = env.tokenEncKey()
  if (!k) throw new Error('TOKEN_ENC_KEY not configured')
  return createHash('sha256').update(k).digest()
}
export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', keyBuf(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}
export function decryptToken(s: string): string {
  const [iv, tag, enc] = s.split('.').map((x) => Buffer.from(x, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', keyBuf(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

// ── OAuth ─────────────────────────────────────────────────────
export function getAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.googleClientId() ?? '',
    redirect_uri: env.googleRedirectUri() ?? '',
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId() ?? '',
      client_secret: env.googleClientSecret() ?? '',
      redirect_uri: env.googleRedirectUri() ?? '',
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
  return res.json()
}

export async function storeTokens(userId: string, tok: TokenResponse): Promise<void> {
  const expiryDate = BigInt(Date.now() + tok.expires_in * 1000)
  await prisma.googleAuth.upsert({
    where: { userId },
    update: {
      accessToken: encryptToken(tok.access_token),
      ...(tok.refresh_token ? { refreshToken: encryptToken(tok.refresh_token) } : {}),
      expiryDate,
      scope: tok.scope ?? SCOPE,
    },
    create: {
      userId,
      accessToken: encryptToken(tok.access_token),
      refreshToken: encryptToken(tok.refresh_token ?? ''),
      expiryDate,
      scope: tok.scope ?? SCOPE,
    },
  })
}

/** Return a valid access token, refreshing if it has expired. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const auth = await prisma.googleAuth.findUnique({ where: { userId } })
  if (!auth) return null
  if (Number(auth.expiryDate) > Date.now() + 60_000) return decryptToken(auth.accessToken)

  const refresh = decryptToken(auth.refreshToken)
  if (!refresh) return null
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: env.googleClientId() ?? '',
      client_secret: env.googleClientSecret() ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const tok = (await res.json()) as TokenResponse
  await storeTokens(userId, { ...tok, refresh_token: tok.refresh_token ?? refresh })
  return tok.access_token
}

// ── Calendar events ───────────────────────────────────────────
interface TaskEventInput {
  title: string
  description?: string | null
  startMs: number
  endMs: number
}
function eventBody(t: TaskEventInput) {
  return {
    summary: t.title,
    description: t.description ?? undefined,
    start: { dateTime: new Date(t.startMs).toISOString() },
    end: { dateTime: new Date(t.endMs).toISOString() },
  }
}

export async function insertEvent(userId: string, calendarId: string, t: TaskEventInput): Promise<string | null> {
  const token = await getValidAccessToken(userId)
  if (!token) return null
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody(t)),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function patchEvent(userId: string, calendarId: string, eventId: string, t: TaskEventInput): Promise<boolean> {
  const token = await getValidAccessToken(userId)
  if (!token) return false
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody(t)),
    },
  )
  return res.ok
}

export async function deleteEvent(userId: string, calendarId: string, eventId: string): Promise<boolean> {
  const token = await getValidAccessToken(userId)
  if (!token) return false
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  )
  return res.ok || res.status === 410 // 410 = already gone
}
