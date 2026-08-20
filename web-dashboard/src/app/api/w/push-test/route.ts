import { NextRequest, NextResponse } from 'next/server'
import { requireWebUser, AuthError } from '@/lib/auth'
import { sendToUser } from '@/lib/fcm'

// POST /api/w/push-test — send a test push to the signed-in user's devices (verification/dev).
export async function POST(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    const count = await sendToUser(user.id, '🎭 Mi Vida', 'Test push — how are you feeling?', { action: 'mood_check' })
    return NextResponse.json({ ok: true, delivered: count })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[push-test] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
