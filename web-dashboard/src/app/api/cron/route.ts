import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { runCron } from '@/lib/cron'

// GET/POST /api/cron — runs the server time-authority jobs. Guarded by CRON_SECRET
// (Authorization: Bearer <secret>, or ?secret=<secret> for schedulers that can't set headers).
async function handle(req: NextRequest) {
  const secret = env.cronSecret()
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const auth = req.headers.get('authorization')
  const qp = req.nextUrl.searchParams.get('secret')
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : qp
  if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const report = await runCron(prisma, Date.now())
    return NextResponse.json({ ok: true, report })
  } catch (err) {
    console.error('[cron] error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
