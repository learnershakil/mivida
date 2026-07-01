import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Task from '../database/models/Task';
import { emitEvent, EventTypes } from './eventLogger';
import { pauseTask } from './taskService';
import { shouldAutoFail, shouldRenewFixed } from './taskLifecycle';

/**
 * Device-side reconciliation of time-based task state. Runs on app launch (app/_layout.tsx). The backend
 * cron (ARCHITECTURE.md §7) is the authority; this keeps the device consistent between syncs. Rules live in
 * taskLifecycle.ts so device + server agree.
 */
export async function runTaskMaintenance(userId: string) {
  try {
    console.log('[TaskMaintenance] Running routine checks...');
    const now = Date.now();

    const allTasks = await database
      .get<Task>('tasks')
      .query(Q.where('user_id', userId), Q.where('deleted_at', null))
      .fetch();

    // Auto-fail pass may need to pause active tasks first (pauseTask has its own write), so collect decisions.
    const toFail = allTasks.filter((t) =>
      shouldAutoFail(
        { type: t.type, isCompleted: t.isCompleted, isCancelled: t.isCancelled, endTime: t.endTime },
        now,
      ),
    );
    for (const task of toFail) {
      if (task.isActive) {
        await pauseTask(task, userId, 'Auto-paused: task expired');
      }
    }

    await database.write(async () => {
      for (const task of allTasks) {
        // 1. Auto-FAIL custom tasks left incomplete >6h past their end time.
        //    Distinct `failed` state (not `cancelled`); fixed/alert tasks are never swept.
        if (
          shouldAutoFail(
            {
              type: task.type,
              isCompleted: task.isCompleted,
              isCancelled: task.isCancelled,
              endTime: task.endTime,
            },
            now,
          )
        ) {
          await task.update((t) => {
            t.isActive = false;
            t.status = 'failed';
            t.failedAt = now;
          });
          await emitEvent({
            eventType: EventTypes.TASK_FAILED,
            entityType: 'task',
            entityId: task.id,
            userId,
            payload: { reason: 'Auto-failed: exceeded 6h past end time', autoMarked: true },
          });
          continue; // terminal; skip renewal
        }

        // 2. 5:00 AM renewal for completed FIXED routines (reset for the new day).
        if (
          shouldRenewFixed(
            {
              type: task.type,
              isCompleted: task.isCompleted,
              updatedAt: task.updatedAt,
              createdAt: task.createdAt,
            },
            now,
          )
        ) {
          await task.update((t) => {
            t.isCompleted = false;
            t.completionPercent = 0;
            t.totalElapsedSeconds = 0;
            t.completionRemark = '';
            t.completedAt = undefined;
            t.status = 'pending';
          });
          await emitEvent({
            eventType: EventTypes.TASK_RENEWED,
            entityType: 'task',
            entityId: task.id,
            userId,
            payload: { renewedAt: now, title: task.title },
          });
          console.log(`[TaskMaintenance] Renewed fixed task: ${task.title}`);
        }
      }
    });
    console.log('[TaskMaintenance] Routine checks complete.');
  } catch (error) {
    console.error('[TaskMaintenance] Failed:', error);
  }
}
