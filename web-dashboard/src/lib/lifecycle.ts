// Server mirror of mobile-app/services/taskLifecycle.ts — the time-based task rules, kept in sync so the
// backend cron (the authority) and the device agree. Pure + unit-tested (lifecycle.test.ts).

export const SIX_HOURS_MS = 6 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** Start (ms) of the current 5:00 AM renewal cycle relative to `now` (UTC-based; tz refinement is a follow-on). */
export function resetCycleStart(now: number): number {
  const d = new Date(now)
  const today5 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5, 0, 0, 0)
  if (now >= today5) return today5
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1, 5, 0, 0, 0)
}

/** Midnight (ms) of the day containing `t` (UTC). */
export function dayBucket(t: number): number {
  const d = new Date(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
}

/** A CUSTOM task is auto-failed once >6h past end and not completed/cancelled. Fixed/alert never. */
export function shouldAutoFail(
  task: { type: string; isCompleted?: boolean; isCancelled?: boolean | null; endTime?: bigint | null },
  now: number,
): boolean {
  if (task.type !== 'custom') return false
  if (task.isCompleted || task.isCancelled) return false
  if (task.endTime === null || task.endTime === undefined) return false
  return now - Number(task.endTime) > SIX_HOURS_MS
}

/** A completed FIXED task renews if last touched before the current 5AM cycle. */
export function shouldRenewFixed(
  task: { type: string; isCompleted?: boolean; updatedAt?: bigint | null },
  now: number,
): boolean {
  if (task.type !== 'fixed') return false
  if (!task.isCompleted) return false
  const last = task.updatedAt !== null && task.updatedAt !== undefined ? Number(task.updatedAt) : 0
  return last < resetCycleStart(now)
}

/** The next `count` day-buckets (midnight ms) starting today, for fixed-task allocation. */
export function next7Days(now: number, count = 7): number[] {
  const start = dayBucket(now)
  return Array.from({ length: count }, (_, i) => start + i * DAY_MS)
}
