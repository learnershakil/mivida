import { NextRequest, NextResponse } from 'next/server'
import { requireWebUser, AuthError } from '@/lib/auth'

// GET /api/w/auth/session → { user } if authenticated, else 401
export async function GET(req: NextRequest) {
  try {
    const user = await requireWebUser(req)
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[session] error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
