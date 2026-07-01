/**
 * taskLifecycle — pure, DB-free task lifecycle decisions.
 *
 * Extracted so the time-based rules (5AM renewal, 6h custom fail, 16h "Completed Today" hide) are a single
 * source of truth shared by taskMaintenance (device) and the UI, and are unit-testable without WatermelonDB.
 * The backend cron (ARCHITECTURE.md §7) will mirror these same rules as the authority.
 */

export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
export const SIXTEEN_HOURS_MS = 16 * 60 * 60 * 1000;
export const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export type TaskStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'cancelled';

export interface LifecycleTask {
  type: 'fixed' | 'custom' | 'alert';
  isCompleted?: boolean;
  isCancelled?: boolean;
  endTime?: number;
  updatedAt?: number;
  createdAt?: number;
  completedAt?: number;
}

/** Start (ms) of the current 5:00 AM renewal cycle relative to `now`. */
export function resetCycleStart(now: number): number {
  const d = new Date(now);
  const today5 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0, 0).getTime();
  if (now >= today5) return today5;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 5, 0, 0, 0).getTime();
}

/**
 * A CUSTOM task is auto-failed once it is >6h past its end time and not already completed/cancelled.
 * Fixed and alert tasks are NEVER auto-failed (fixes AUDIT §4: 6h sweep wrongly cancelled fixed routines).
 */
export function shouldAutoFail(task: LifecycleTask, now: number): boolean {
  if (task.type !== 'custom') return false;
  if (task.isCompleted || task.isCancelled) return false;
  if (!task.endTime) return false;
  return now - task.endTime > SIX_HOURS_MS;
}

/** A completed task stays in "Completed Today" for 16h after its completion time. */
export function isWithinCompletedWindow(completedAt: number | undefined, now: number): boolean {
  if (!completedAt) return false;
  return now - completedAt <= SIXTEEN_HOURS_MS;
}

/** Terminal (completed/cancelled/failed) tasks stay in the recent preview for 48h. */
export function isWithinRecentWindow(at: number | undefined, now: number): boolean {
  if (!at) return true; // no timestamp → don't hide
  return now - at <= FORTY_EIGHT_HOURS_MS;
}

/**
 * A completed FIXED task renews (resets its completion state) if it was last touched before the current
 * 5:00 AM cycle. Incomplete fixed tasks are not "renewed" — they simply carry into the new day.
 */
export function shouldRenewFixed(task: LifecycleTask, now: number): boolean {
  if (task.type !== 'fixed') return false;
  if (!task.isCompleted) return false;
  const last = task.updatedAt ?? task.createdAt ?? 0;
  return last < resetCycleStart(now);
}

/** Fixed tasks are scheduled by time-of-day only (no calendar date). */
export function isTimeOnlyType(type: LifecycleTask['type']): boolean {
  return type === 'fixed';
}
