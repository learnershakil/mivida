import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Task from '../database/models/Task';
import { emitEvent, EventTypes } from './eventLogger';
import { pauseTask } from './taskService';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function runTaskMaintenance(userId: string) {
  try {
    console.log('[TaskMaintenance] Running routine checks...');
    const now = Date.now();
    const currentDate = new Date(now);
    
    // Calculate 5:00 AM for today
    const resetTimeToday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      5, 0, 0, 0
    ).getTime();

    // Calculate 5:00 AM for yesterday
    const resetTimeYesterday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() - 1,
      5, 0, 0, 0
    ).getTime();

    const currentResetCycleStart = now >= resetTimeToday ? resetTimeToday : resetTimeYesterday;

    const allTasks = await database.get<Task>('tasks').query(
      Q.where('user_id', userId),
      Q.where('deleted_at', null)
    ).fetch();

    await database.write(async () => {
      for (const task of allTasks) {
        // 1. Auto-mark incomplete tasks after 6 hours of expected end time
        if (!task.isCompleted && !task.isCancelled && task.endTime) {
          const timeSinceEnd = now - task.endTime;
          if (timeSinceEnd > SIX_HOURS_MS) {
             if (task.isActive) {
                 await pauseTask(task, userId, 'Auto-paused: task expired');
             }
             await task.update(t => {
                t.isActive = false;
                t.isCancelled = true;
                t.cancelReason = 'Auto-marked incomplete (exceeded 6h past end time)';
                t.cancelledAt = now;
             });
             await emitEvent({
               eventType: EventTypes.TASK_CANCELLED,
               entityType: 'task',
               entityId: task.id,
               userId,
               payload: { reason: 'Auto-marked incomplete', autoMarked: true }
             });
             continue; // Task is now cancelled, skip renewal check
          }
        }

        // 2. 5:00 AM Renewal for "Fixed" routines
        // If a fixed task was created/scheduled before the current 5 AM cycle, reset its completion state
        if (task.type === 'fixed') {
            const lastUpdated = task.updatedAt || task.createdAt;
            if (lastUpdated < currentResetCycleStart && task.isCompleted) {
                await task.update(t => {
                   t.isCompleted = false;
                   t.completionPercent = 0;
                   t.totalElapsedSeconds = 0;
                   t.completionRemark = ''; // Clear remark for the new day
                });
                console.log(`[TaskMaintenance] Renewed fixed task: ${task.title}`);
            }
        }
      }
    });
    console.log('[TaskMaintenance] Routine checks complete.');
  } catch (error) {
    console.error('[TaskMaintenance] Failed:', error);
  }
}
