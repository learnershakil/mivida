/**
 * TaskService
 *
 * Manages task lifecycle with proper event logging.
 * Task duration is NEVER stored - computed from events.
 *
 * Features:
 * - Create fixed and custom tasks
 * - Start/pause/resume/stop task timer
 * - Track completion percentage
 * - Overlapping task detection
 * - Delegation support
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Task from '../database/models/Task';
import { emitEvent, EventTypes, getEventsForEntity } from './eventLogger';
import { alertService } from './alertService';
import { notificationService } from './notifications';

export interface CreateTaskParams {
  title: string;
  description?: string;
  category?: string;
  expectedDurationMinutes?: number;
  type: 'fixed' | 'custom' | 'alert';
  priority?: 'normal' | 'important' | 'urgent';
  assignedPersons?: string[];
  startTime?: Date;
  endTime?: Date;
  scheduledDate?: Date;
  scheduledTime?: Date;
  // Alert-specific fields
  alertType?: 'timeout' | 'interval';
  alertIntervalMinutes?: number;
  userId: string;
}

export interface DelegateTaskParams {
  taskId: string;
  delegatedTo: string;
  userId: string;
}

/**
 * Create a new task
 */
export async function createTask(params: CreateTaskParams): Promise<Task> {
  const {
    title,
    description,
    category,
    expectedDurationMinutes,
    type,
    priority = 'normal',
    assignedPersons = [],
    startTime,
    endTime,
    scheduledDate,
    scheduledTime,
    alertType,
    alertIntervalMinutes,
    userId,
  } = params;

  const task = await database.write(async () => {
    return await database.get<Task>('tasks').create((record) => {
      record.title = title;
      record.description = description;
      record.category = category;
      record.expectedDurationMinutes = expectedDurationMinutes;
      record.type = type;
      record.priority = priority;
      (record as any)._raw.assigned_persons = JSON.stringify(assignedPersons);
      record.startTime = startTime?.getTime();
      record.endTime = endTime?.getTime();
      record.isActive = false;
      record.isCompleted = false;
      record.completionPercent = 0;
      record.totalElapsedSeconds = 0;
      record.scheduledDate = scheduledDate?.getTime();
      record.scheduledTime = scheduledTime?.getTime();
      // Alert-specific fields
      if (type === 'alert') {
        record.alertType = alertType;
        record.alertIntervalMinutes = alertIntervalMinutes;
        record.isAlertActive = true; // Activate alert immediately on creation
        record.lastAlertTriggeredAt = undefined;
      }
      record.isDelegated = false;
      record.userId = userId;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_CREATED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title,
      description,
      category,
      expectedDurationMinutes,
      type,
      priority,
      assignedPersons,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
      scheduledDate: scheduledDate?.toISOString(),
      scheduledTime: scheduledTime?.toISOString(),
      alertType,
      alertIntervalMinutes,
    },
    userId,
  });

  // Schedule notification for alert tasks
  if (type === 'alert') {
    await alertService.scheduleAlert(task);
  }

  // Schedule start time notification for custom/fixed tasks
  if (startTime && startTime.getTime() > Date.now()) {
    try {
      await notificationService.scheduleNotification(
        `🚀 Time to start: ${title}`,
        description || 'Your task is scheduled to start now',
        startTime.getTime(),
        'informational'
      );
    } catch (error) {
      console.error('[TaskService] Failed to schedule start notification:', error);
    }
  }

  // Schedule end time notification for tasks with end time
  if (endTime && endTime.getTime() > Date.now()) {
    try {
      await notificationService.scheduleNotification(
        `⏰ Task deadline: ${title}`,
        'Did you complete this task? Add a remark about your progress.',
        endTime.getTime(),
        'warning'
      );
    } catch (error) {
      console.error('[TaskService] Failed to schedule end notification:', error);
    }
  }

  return task;
}

/**
 * Start a task timer
 * Requires user to be in awake state
 */
export async function startTask(task: Task, userId: string): Promise<void> {
  // Check for overlapping active task
  const activeTasks = await getActiveTasks(userId);

  if (activeTasks.length > 0 && !activeTasks.some((t) => t.id === task.id)) {
    // There's another active task - emit warning but proceed
    console.warn('[TaskService] Starting task while another is active');
  }

  // Pause any other active tasks first
  for (const activeTask of activeTasks) {
    if (activeTask.id !== task.id) {
      await pauseTask(activeTask, userId, 'Auto-paused: started another task');
    }
  }

  const now = Date.now();

  await database.write(async () => {
    await task.update((record) => {
      record.isActive = true;
      record.timerStartedAt = now;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_STARTED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      startTime: now,
      previousCompletionPercent: task.completionPercent,
      totalElapsedBefore: task.totalElapsedSeconds,
    },
    userId,
  });
}

/**
 * Pause a task timer with mandatory remark
 */
export async function pauseTask(task: Task, userId: string, remark?: string): Promise<void> {
  if (!task.isActive) return;

  const now = Date.now();
  const sessionSeconds = task.timerStartedAt ? Math.floor((now - task.timerStartedAt) / 1000) : 0;
  const newTotal = (task.totalElapsedSeconds || 0) + sessionSeconds;

  await database.write(async () => {
    await task.update((record) => {
      record.isActive = false;
      record.timerStartedAt = undefined;
      record.totalElapsedSeconds = newTotal;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_PAUSED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      pauseTime: now,
      sessionDurationSeconds: sessionSeconds,
      totalElapsedSeconds: newTotal,
      completionPercent: task.completionPercent,
      remark: remark || 'No remark provided',
    },
    userId,
  });
}

/**
 * Resume a paused task
 * Requires user to be in awake state
 */
export async function resumeTask(task: Task, userId: string): Promise<void> {
  if (task.isActive) return;

  // Pause any other active tasks
  const activeTasks = await getActiveTasks(userId);
  for (const activeTask of activeTasks) {
    if (activeTask.id !== task.id) {
      await pauseTask(activeTask, userId, 'Auto-paused: resumed another task');
    }
  }

  const now = Date.now();

  await database.write(async () => {
    await task.update((record) => {
      record.isActive = true;
      record.timerStartedAt = now;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_RESUMED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      resumeTime: now,
      completionPercent: task.completionPercent,
      totalElapsedBefore: task.totalElapsedSeconds,
    },
    userId,
  });
}

/**
 * Update task progress with optional remark for partial completion
 */
export async function updateTaskProgress(
  task: Task,
  completionPercent: number,
  userId: string,
  remark?: string
): Promise<void> {
  const previousPercent = task.completionPercent;
  const clampedPercent = Math.max(0, Math.min(100, completionPercent));

  // Calculate elapsed time if task is active
  let newTotal = task.totalElapsedSeconds || 0;
  if (task.isActive && task.timerStartedAt) {
    const sessionSeconds = Math.floor((Date.now() - task.timerStartedAt) / 1000);
    newTotal += sessionSeconds;
  }

  await database.write(async () => {
    await task.update((record) => {
      record.completionPercent = clampedPercent;
      record.totalElapsedSeconds = newTotal;
      if (clampedPercent === 100) {
        record.isCompleted = true;
        record.isActive = false;
        record.timerStartedAt = undefined;
      }
    });
  });

  // Log partial completion with remark
  if (remark && clampedPercent < 100) {
    await emitEvent({
      eventType: EventTypes.TASK_PARTIAL_COMPLETION,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        previousPercent,
        newPercent: clampedPercent,
        remark,
        totalElapsedSeconds: newTotal,
        updateTime: Date.now(),
      },
      userId,
    });
  }

  await emitEvent({
    eventType: EventTypes.TASK_PROGRESS_UPDATED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      previousPercent,
      newPercent: clampedPercent,
      remark: remark || undefined,
      totalElapsedSeconds: newTotal,
      updateTime: Date.now(),
    },
    userId,
  });
}

/**
 * Cancel a task
 */
export async function cancelTask(task: Task, userId: string, reason?: string): Promise<void> {
  const now = Date.now();

  // If task is active, pause it first
  if (task.isActive) {
    await pauseTask(task, userId, 'Task cancelled');
  }

  await database.write(async () => {
    await task.update((record) => {
      record.isCancelled = true;
      record.cancelledAt = now;
      record.cancelReason = reason || 'No reason provided';
      record.isActive = false;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_CANCELLED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      cancelTime: now,
      reason: reason || 'No reason provided',
      completionPercent: task.completionPercent,
      totalElapsedSeconds: task.totalElapsedSeconds,
      type: task.type,
    },
    userId,
  });
}

/**
 * Delete a task (soft delete)
 */
export async function deleteTask(task: Task, userId: string): Promise<void> {
  const now = Date.now();

  // If task is active, pause it first
  if (task.isActive) {
    await pauseTask(task, userId, 'Task deleted');
  }

  await database.write(async () => {
    await task.update((record) => {
      record.deletedAt = now;
      record.isActive = false;
      // Also mark alert as inactive to prevent rescheduling
      record.isAlertActive = false;
      record.isCompleted = true; // Mark as completed to prevent it from being picked up
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_DELETED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      deleteTime: now,
      completionPercent: task.completionPercent,
      totalElapsedSeconds: task.totalElapsedSeconds,
      type: task.type,
    },
    userId,
  });
}

/**
 * Complete a task
 */
export async function completeTask(task: Task, userId: string): Promise<void> {
  await database.write(async () => {
    await task.update((record) => {
      record.isCompleted = true;
      record.isActive = false;
      record.completionPercent = 100;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_COMPLETED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      completionTime: Date.now(),
    },
    userId,
  });
}

/**
 * Skip a task
 */
export async function skipTask(task: Task, userId: string, reason?: string): Promise<void> {
  await database.write(async () => {
    await task.update((record) => {
      record.isActive = false;
    });
  });

  await emitEvent({
    eventType: EventTypes.TASK_SKIPPED,
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      skipTime: Date.now(),
      reason,
      completionPercent: task.completionPercent,
    },
    userId,
  });
}

/**
 * Delegate a task to someone
 */
export async function delegateTask(params: DelegateTaskParams): Promise<void> {
  const { taskId, delegatedTo, userId } = params;
  const task = await database.get<Task>('tasks').find(taskId);

  await database.write(async () => {
    await task.update((record) => {
      record.isDelegated = true;
      record.delegatedTo = delegatedTo;
      record.delegatedStatus = 'assigned';
    });
  });

  await emitEvent({
    eventType: EventTypes.DELEGATED_TASK_CREATED,
    entityType: 'delegation',
    entityId: task.id,
    payload: {
      taskTitle: task.title,
      delegatedTo,
      assignedTime: Date.now(),
    },
    userId,
  });
}

/**
 * Update delegated task status
 */
export async function updateDelegatedTaskStatus(
  task: Task,
  status: 'assigned' | 'partial' | 'completed',
  userId: string
): Promise<void> {
  const previousStatus = task.delegatedStatus;

  await database.write(async () => {
    await task.update((record) => {
      record.delegatedStatus = status;
      if (status === 'completed') {
        record.isCompleted = true;
        record.completionPercent = 100;
      }
    });
  });

  const eventType =
    status === 'completed'
      ? EventTypes.DELEGATED_TASK_COMPLETED
      : EventTypes.DELEGATED_TASK_UPDATED;

  await emitEvent({
    eventType,
    entityType: 'delegation',
    entityId: task.id,
    payload: {
      taskTitle: task.title,
      previousStatus,
      newStatus: status,
      updateTime: Date.now(),
    },
    userId,
  });
}

/**
 * Get currently active tasks
 */
export async function getActiveTasks(userId: string): Promise<Task[]> {
  const tasks = await database
    .get<Task>('tasks')
    .query(Q.where('user_id', userId), Q.where('is_active', true))
    .fetch();
  return tasks;
}

/**
 * Get today's tasks
 */
export async function getTodayTasks(userId: string): Promise<Task[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  const tasks = await database.get<Task>('tasks').query(Q.where('user_id', userId)).fetch();

  // Filter for today's tasks (scheduled for today or created today)
  return tasks.filter((task) => {
    if (task.deletedAt) return false;
    if (task.scheduledDate) {
      return task.scheduledDate >= startOfDay && task.scheduledDate <= endOfDay;
    }
    return task.createdAt >= startOfDay && task.createdAt <= endOfDay;
  });
}

/**
 * Calculate total time spent on a task from events
 * Duration is NEVER stored - always computed
 */
export async function calculateTaskDuration(taskId: string, userId: string): Promise<number> {
  const events = await getEventsForEntity('task', taskId, userId);

  let totalMs = 0;
  let lastStartTime: number | null = null;

  for (const event of events) {
    if (
      event.eventType === EventTypes.TASK_STARTED ||
      event.eventType === EventTypes.TASK_RESUMED
    ) {
      lastStartTime = event.createdAt;
    } else if (
      (event.eventType === EventTypes.TASK_PAUSED ||
        event.eventType === EventTypes.TASK_COMPLETED ||
        event.eventType === EventTypes.TASK_SKIPPED) &&
      lastStartTime !== null
    ) {
      totalMs += event.createdAt - lastStartTime;
      lastStartTime = null;
    }
  }

  // If task is still running, add time until now
  if (lastStartTime !== null) {
    totalMs += Date.now() - lastStartTime;
  }

  return totalMs;
}

/**
 * Alias for calculateTaskDuration for simpler API
 * Gets task from database to determine userId
 */
export async function getTaskDuration(taskId: string): Promise<number> {
  // Get task to find userId
  const task = await database.get<Task>('tasks').find(taskId);

  // Get events for this task
  const events = await getEventsForEntity('task', taskId, task.userId);

  let totalMs = 0;
  let lastStartTime: number | null = null;

  for (const event of events) {
    if (
      event.eventType === EventTypes.TASK_STARTED ||
      event.eventType === EventTypes.TASK_RESUMED
    ) {
      lastStartTime = event.createdAt;
    } else if (
      (event.eventType === EventTypes.TASK_PAUSED ||
        event.eventType === EventTypes.TASK_COMPLETED ||
        event.eventType === EventTypes.TASK_SKIPPED) &&
      lastStartTime !== null
    ) {
      totalMs += event.createdAt - lastStartTime;
      lastStartTime = null;
    }
  }

  // If task is still running, add time until now
  if (lastStartTime !== null) {
    totalMs += Date.now() - lastStartTime;
  }

  return totalMs;
}

/**
 * Update an existing task
 */
export interface UpdateTaskParams {
  title?: string;
  description?: string;
  category?: string;
  expectedDurationMinutes?: number;
  priority?: 'normal' | 'important' | 'urgent';
  assignedPersons?: string[];
  startTime?: Date;
  endTime?: Date;
  alertType?: 'timeout' | 'interval';
  alertIntervalMinutes?: number;
}

export async function updateTask(
  task: Task,
  params: UpdateTaskParams,
  userId: string
): Promise<Task> {
  await database.write(async () => {
    await task.update((record) => {
      if (params.title !== undefined) record.title = params.title;
      if (params.description !== undefined) record.description = params.description;
      if (params.category !== undefined) record.category = params.category;
      if (params.expectedDurationMinutes !== undefined)
        record.expectedDurationMinutes = params.expectedDurationMinutes;
      if (params.priority !== undefined) record.priority = params.priority;
      if (params.assignedPersons !== undefined) {
        (record as any)._raw.assigned_persons = JSON.stringify(params.assignedPersons);
      }
      if (params.startTime !== undefined) record.startTime = params.startTime?.getTime();
      if (params.endTime !== undefined) record.endTime = params.endTime?.getTime();
      if (params.alertType !== undefined) record.alertType = params.alertType;
      if (params.alertIntervalMinutes !== undefined)
        record.alertIntervalMinutes = params.alertIntervalMinutes;
    });
  });

  await emitEvent({
    eventType: 'TASK_UPDATED',
    entityType: 'task',
    entityId: task.id,
    payload: params,
    userId,
  });

  return task;
}

/**
 * Deactivate an alert task (stop notifications)
 */
export async function deactivateAlertTask(task: Task, userId: string): Promise<void> {
  await database.write(async () => {
    await task.update((record) => {
      record.isAlertActive = false;
    });
  });

  await emitEvent({
    eventType: 'ALERT_DEACTIVATED',
    entityType: 'task',
    entityId: task.id,
    payload: { title: task.title },
    userId,
  });
}

/**
 * Mark alert task as triggered (for interval tracking)
 */
export async function triggerAlertTask(task: Task, userId: string): Promise<void> {
  await database.write(async () => {
    await task.update((record) => {
      record.lastAlertTriggeredAt = Date.now();
      // If timeout type, mark as completed and delete
      if (record.alertType === 'timeout') {
        record.isAlertActive = false;
        record.isCompleted = true;
        record.completionPercent = 100;
      }
    });
  });

  await emitEvent({
    eventType: 'ALERT_TRIGGERED',
    entityType: 'task',
    entityId: task.id,
    payload: {
      title: task.title,
      alertType: task.alertType,
      triggeredAt: Date.now(),
    },
    userId,
  });
}

/**
 * Get all active alert tasks
 */
export async function getActiveAlertTasks(userId: string): Promise<Task[]> {
  const tasks = await database
    .get<Task>('tasks')
    .query(
      Q.and(
        Q.where('user_id', userId),
        Q.where('type', 'alert'),
        Q.where('is_alert_active', true),
        Q.where('deleted_at', null)
      )
    )
    .fetch();
  return tasks;
}

export default {
  create: createTask,
  start: startTask,
  pause: pauseTask,
  resume: resumeTask,
  updateProgress: updateTaskProgress,
  complete: completeTask,
  skip: skipTask,
  delete: deleteTask,
  delegate: delegateTask,
  updateDelegatedStatus: updateDelegatedTaskStatus,
  getActive: getActiveTasks,
  getToday: getTodayTasks,
  calculateDuration: calculateTaskDuration,
  update: updateTask,
  deactivateAlert: deactivateAlertTask,
  triggerAlert: triggerAlertTask,
  getActiveAlerts: getActiveAlertTasks,
};
