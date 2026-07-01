// Backend cron jobs — the server is the time-authority (ARCHITECTURE §7). Each job mutates Postgres
// idempotently; the device reconciles on the next sync pull (serverUpdatedAt advances). Invoked by
// /api/cron behind CRON_SECRET.
import type { PrismaClient } from '@prisma/client'
import { shouldAutoFail, shouldRenewFixed, next7Days, fatigueTriggered, dayBucket } from '@/lib/lifecycle'
import { fetchAndStoreWakatime } from '@/lib/wakatime'

type DB = PrismaClient

export interface CronReport {
  ranAt: number
  renewedFixed: number
  failedCustom: number
  triggeredFinance: number
  allocatedInstances: number
  fatigueTasks: number
  wakatimeSynced: number
}

/** Fixed-task 5AM renewal — reset completed daily routines. Skipped for users in Holiday day-mode. */
async function renewFixed(db: DB, now: number): Promise<number> {
  const holidayUserIds = new Set(
    (await db.setting.findMany({ where: { taskMode: 'holiday' }, select: { userId: true } })).map(
      (s) => s.userId,
    ),
  )
  const fixed = await db.task.findMany({
    where: { type: 'fixed', isCompleted: true, deletedAt: null },
  })
  let n = 0
  for (const t of fixed) {
    if (holidayUserIds.has(t.userId)) continue
    if (!shouldRenewFixed(t, now)) continue
    await db.task.update({
      where: { id: t.id },
      data: {
        isCompleted: false,
        completionPercent: 0,
        totalElapsedSeconds: 0,
        completionRemark: null,
        completedAt: null,
        status: 'pending',
        updatedAt: BigInt(now),
      },
    })
    n++
  }
  return n
}

/** Custom-task 6h fail sweep — distinct `failed` state (not cancelled). */
async function failExpiredCustom(db: DB, now: number): Promise<number> {
  const candidates = await db.task.findMany({
    where: { type: 'custom', isCompleted: false, isCancelled: false, deletedAt: null, endTime: { not: null } },
  })
  let n = 0
  for (const t of candidates) {
    if (!shouldAutoFail(t, now)) continue
    await db.task.update({
      where: { id: t.id },
      data: { status: 'failed', failedAt: BigInt(now), isActive: false, updatedAt: BigInt(now) },
    })
    n++
  }
  return n
}

/** Trigger scheduled finance transactions whose date has arrived. */
async function triggerScheduledFinance(db: DB, now: number): Promise<number> {
  const res = await db.financeLog.updateMany({
    where: { isScheduled: true, isTriggered: false, isCancelled: false, scheduledFor: { lte: BigInt(now) } },
    data: { isTriggered: true, updatedAt: BigInt(now) },
  })
  return res.count
}

/** Ensure the next 7 days of TaskInstance rows exist for each active fixed task. */
async function allocateFixedInstances(db: DB, now: number): Promise<number> {
  const fixed = await db.task.findMany({ where: { type: 'fixed', deletedAt: null } })
  const days = next7Days(now)
  let n = 0
  for (const t of fixed) {
    for (const date of days) {
      // Unique (taskId, date) — createMany skipDuplicates makes this idempotent.
      const created = await db.taskInstance.createMany({
        data: [
          {
            id: `${t.id}:${date}`,
            userId: t.userId,
            taskId: t.id,
            date: BigInt(date),
            status: 'pending',
            updatedAt: BigInt(now),
          },
        ],
        skipDuplicates: true,
      })
      n += created.count
    }
  }
  return n
}

/**
 * Physical Fatigue vs Screen Time: when today's screen time is high AND steps are low, auto-create a
 * mandatory physical-activity fixed task (once per user per day). Thresholds come from Setting.insights.
 */
async function fatigueTrigger(db: DB, now: number): Promise<number> {
  const day = dayBucket(now)
  const users = await db.user.findMany({ include: { setting: true } })
  let n = 0
  for (const u of users) {
    const [sensor, usage] = await Promise.all([
      db.sensorStat.findUnique({ where: { userId_date: { userId: u.id, date: BigInt(day) } } }),
      db.usageStat.findUnique({ where: { userId_date: { userId: u.id, date: BigInt(day) } } }),
    ])
    if (!sensor && !usage) continue // no data collected yet

    const steps = sensor?.steps ?? 0
    const screenMs = usage ? Number(usage.totalScreenMs) : 0
    const insights = (u.setting?.insights as { fatigue?: { screenTimeHours?: number; steps?: number } }) ?? {}
    const thr = {
      screenTimeHours: insights.fatigue?.screenTimeHours ?? 6,
      steps: insights.fatigue?.steps ?? 1000,
    }
    if (!fatigueTriggered(screenMs, steps, thr)) continue

    const created = await db.task.createMany({
      data: [
        {
          id: `fatigue:${u.id}:${day}`, // deterministic → idempotent per day
          userId: u.id,
          title: 'Physical activity break',
          description: 'Auto-created: high screen time and low steps today. Move for a bit.',
          type: 'fixed',
          priority: 'important',
          status: 'pending',
          isTimeOnly: true,
          createdAt: BigInt(now),
          updatedAt: BigInt(now),
        },
      ],
      skipDuplicates: true,
    })
    n += created.count
  }
  return n
}

/** Refresh WakaTime coding stats for every user (upsert dedups the day's row). Best-effort. */
async function syncWakatime(db: DB): Promise<number> {
  const users = await db.user.findMany({ select: { id: true } })
  let n = 0
  for (const u of users) {
    try {
      const stats = await fetchAndStoreWakatime(db, u.id)
      if (stats) n++
    } catch (err) {
      console.warn('[cron] wakatime failed for', u.id, err)
    }
  }
  return n
}

export async function runCron(db: DB, now: number): Promise<CronReport> {
  const [renewedFixed, failedCustom, triggeredFinance, allocatedInstances, fatigueTasks, wakatimeSynced] = [
    await renewFixed(db, now),
    await failExpiredCustom(db, now),
    await triggerScheduledFinance(db, now),
    await allocateFixedInstances(db, now),
    await fatigueTrigger(db, now),
    await syncWakatime(db),
  ]
  return {
    ranAt: now,
    renewedFixed,
    failedCustom,
    triggeredFinance,
    allocatedInstances,
    fatigueTasks,
    wakatimeSynced,
  }
}
