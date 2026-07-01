import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileUser, AuthError } from '@/lib/auth'
import { applyPush, buildPull } from '@/lib/sync'

// POST /api/m/sync  { changes, lastPulledAt } → { success, timestamp }   (idempotent, atomic)
export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const body = await req.json().catch(() => null)
    const changes = body?.changes
    if (!changes) return NextResponse.json({ error: 'Missing changes payload' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await applyPush(tx, user.id, changes)
      await tx.syncState.upsert({
        where: { userId: user.id },
        update: { deviceLastSyncAt: BigInt(Date.now()) },
        create: { userId: user.id, deviceLastSyncAt: BigInt(Date.now()) },
      })
    })

    // Only advance the client watermark after a fully successful commit.
    return NextResponse.json({ success: true, timestamp: Date.now() })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[m/sync] push error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET /api/m/sync?lastPulledAt=<ms> → { changes, timestamp }
export async function GET(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const lastPulledAt = req.nextUrl.searchParams.get('lastPulledAt')
    const since = lastPulledAt && lastPulledAt !== '0' ? new Date(Number(lastPulledAt)) : new Date(0)

    const { changes } = await buildPull(prisma, user.id, since)
    return NextResponse.json({ changes, timestamp: Date.now() })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[m/sync] pull error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
