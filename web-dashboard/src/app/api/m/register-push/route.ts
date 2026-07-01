import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileUser, AuthError } from '@/lib/auth'

// POST /api/m/register-push { token } — register/refresh this device's FCM token.
export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: user.id, updatedAt: new Date() },
      create: { userId: user.id, token, platform: 'android' },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[register-push] error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
