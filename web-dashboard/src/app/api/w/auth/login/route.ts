import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth'

// POST /api/w/auth/login  { email, password } → sets httpOnly session cookie
//
// Bootstrap: if the DB has no user yet but the env admin creds (WEB_ADMIN_EMAIL +
// WEB_ADMIN_PASSWORD_HASH) match, create the single User (seeded with MOBILE_HTTP_KEY).
export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json().catch(() => ({}))) as {
      email?: string
      password?: string
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    let user = await prisma.user.findUnique({ where: { email } })

    // First-run bootstrap of the single admin user.
    if (!user && env.webAdminEmail() === email && env.webAdminPasswordHash()) {
      if (!verifyPassword(password, env.webAdminPasswordHash()!)) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      user = await prisma.user.create({
        data: { email, passwordHash: env.webAdminPasswordHash()!, xHttpKey: env.mobileHttpKey() },
      })
    }

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } })
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions)
    return res
  } catch (err) {
    console.error('[login] error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
