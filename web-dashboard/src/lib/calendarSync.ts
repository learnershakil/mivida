// Reconcile tasks ↔ Google Calendar events (ARCHITECTURE §6). Runs from the cron (out of the sync
// transaction). Inserts events for new custom/fixed tasks; deletes events for removed tasks; stores the
// googleEventId so edits patch rather than duplicate.
import type { PrismaClient } from '@prisma/client'
import { insertEvent, patchEvent, deleteEvent } from '@/lib/google'

export interface CalendarReconcileResult {
  created: number
  patched: number
  deleted: number
}

export async function reconcileGoogleCalendar(db: PrismaClient, userId: string): Promise<CalendarReconcileResult> {
  const auth = await db.googleAuth.findUnique({ where: { userId } })
  if (!auth) return { created: 0, patched: 0, deleted: 0 }
  const calendarId = auth.calendarId || 'primary'

  let created = 0
  let patched = 0
  let deleted = 0

  // Insert: custom/fixed tasks with a time window and no event yet.
  const toInsert = await db.task.findMany({
    where: {
      userId,
      type: { in: ['custom', 'fixed'] },
      deletedAt: null,
      googleEventId: null,
      startTime: { not: null },
      endTime: { not: null },
    },
  })
  for (const t of toInsert) {
    const eventId = await insertEvent(userId, calendarId, {
      title: t.title,
      description: t.description,
      startMs: Number(t.startTime),
      endMs: Number(t.endTime),
    })
    if (eventId) {
      await db.task.update({ where: { id: t.id }, data: { googleEventId: eventId } })
      created++
    }
  }

  // Patch: tasks whose event exists and whose row changed after we last touched the event.
  // (Best-effort every run; idempotent — Google accepts identical patches.)
  const toPatch = await db.task.findMany({
    where: {
      userId,
      deletedAt: null,
      googleEventId: { not: null },
      startTime: { not: null },
      endTime: { not: null },
    },
  })
  for (const t of toPatch) {
    const ok = await patchEvent(userId, calendarId, t.googleEventId!, {
      title: t.title,
      description: t.description,
      startMs: Number(t.startTime),
      endMs: Number(t.endTime),
    })
    if (ok) patched++
  }

  // Delete: soft-deleted tasks that still have an event.
  const toDelete = await db.task.findMany({
    where: { userId, deletedAt: { not: null }, googleEventId: { not: null } },
  })
  for (const t of toDelete) {
    const ok = await deleteEvent(userId, calendarId, t.googleEventId!)
    if (ok) {
      await db.task.update({ where: { id: t.id }, data: { googleEventId: null } })
      deleted++
    }
  }

  return { created, patched, deleted }
}
