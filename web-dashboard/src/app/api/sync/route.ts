import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileUser, AuthError } from '@/lib/auth'

// TRANSITIONAL sync route. Secure auth (x-http-key verified — no more silent provisioning) and correct
// typing against the Phase-3 schema. Full table coverage + idempotency tests + vault sanitizer land in
// slice 3.2 as `/api/m/sync`; this route stays as a compatibility alias until the mobile client re-points.
// Coverage here: tasks (c/u/d), contacts (c/u/d), coding_logs (pull). Other tables → slice 3.2.

const toBig = (v: unknown): bigint | null =>
  v === null || v === undefined ? null : BigInt(v as number)

type WmChanges = Record<string, { created?: any[]; updated?: any[]; deleted?: string[] }>

export async function POST(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const body = await req.json().catch(() => null)
    const changes: WmChanges | undefined = body?.changes
    if (!changes) {
      return NextResponse.json({ error: 'Missing changes payload' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // ── Tasks ─────────────────────────────────────────────
      const taskData = (t: any) => ({
        title: t.title,
        description: t.description ?? null,
        categoryName: t.category ?? null,
        type: t.type,
        startDate: toBig(t.start_date),
        endDate: toBig(t.end_date),
        startTime: toBig(t.start_time),
        endTime: toBig(t.end_time),
        isCompleted: !!t.is_completed,
        completionRemark: t.completion_remark ?? null,
        completedAt: toBig(t.completed_at),
        contactId: t.contact_id ?? null,
        updatedAt: toBig(t.updated_at) ?? BigInt(Date.now()),
        deletedAt: toBig(t.deleted_at),
      })
      for (const t of changes.tasks?.created ?? []) {
        await tx.task.upsert({
          where: { id: t.id },
          update: taskData(t),
          create: { id: t.id, userId: user.id, createdAt: toBig(t.created_at) ?? BigInt(Date.now()), ...taskData(t) },
        })
      }
      for (const t of changes.tasks?.updated ?? []) {
        await tx.task.upsert({
          where: { id: t.id },
          update: taskData(t),
          create: { id: t.id, userId: user.id, createdAt: toBig(t.created_at) ?? BigInt(Date.now()), ...taskData(t) },
        })
      }
      for (const id of changes.tasks?.deleted ?? []) {
        await tx.task.updateMany({ where: { id }, data: { deletedAt: BigInt(Date.now()) } })
      }

      // ── Contacts (now with real update + delete, closing the AUDIT §3.2 stub) ──
      const contactData = (c: any) => ({
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        socials: c.socials ?? null,
        updatedAt: toBig(c.updated_at) ?? BigInt(Date.now()),
        deletedAt: toBig(c.deleted_at),
      })
      for (const c of [...(changes.contacts?.created ?? []), ...(changes.contacts?.updated ?? [])]) {
        await tx.contact.upsert({
          where: { id: c.id },
          update: contactData(c),
          create: { id: c.id, userId: user.id, createdAt: toBig(c.created_at) ?? BigInt(Date.now()), ...contactData(c) },
        })
      }
      for (const id of changes.contacts?.deleted ?? []) {
        await tx.contact.updateMany({ where: { id }, data: { deletedAt: BigInt(Date.now()) } })
      }
    })

    return NextResponse.json({ success: true, timestamp: Date.now() })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[sync] push error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireMobileUser(req)
    const lastPulledAt = req.nextUrl.searchParams.get('lastPulledAt')
    const since = lastPulledAt && lastPulledAt !== '0' ? new Date(Number(lastPulledAt)) : new Date(0)

    const codingLogs = await prisma.codingLog.findMany({
      where: { userId: user.id, serverUpdatedAt: { gt: since } },
    })

    const changes = {
      tasks: { created: [], updated: [], deleted: [] },
      contacts: { created: [], updated: [], deleted: [] },
      coding_logs: {
        created: codingLogs.map((l) => ({
          id: l.id,
          user_id: l.userId,
          date: Number(l.date),
          duration: l.duration,
          project: l.project,
          language: l.language,
          created_at: Number(l.createdAt),
          updated_at: Number(l.updatedAt),
        })),
        updated: [],
        deleted: [],
      },
    }

    return NextResponse.json({ changes, timestamp: Date.now() })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[sync] pull error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
