import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileUser, AuthError } from '@/lib/auth'
import { fetchAndStoreWakatime } from '@/lib/wakatime'

// POST /api/wakatime/sync — on-demand WakaTime refresh (also runs from the cron). Secure x-http-key.
export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const stats = await fetchAndStoreWakatime(prisma, user.id)
    if (!stats) return NextResponse.json({ error: 'No WakaTime username configured' }, { status: 400 })
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('WakaTime Sync Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
