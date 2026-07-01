/**
 * DelegationService
 *
 * Handles delegated tasks - tasks assigned to external people.
 * Tracks status: assigned → partial → completed
 */

import { database } from '../database';
import Task from '../database/models/Task';
import { emitEvent, EventTypes } from './eventLogger';
import { Q } from '@nozbe/watermelondb';

export interface DelegatedTaskInput {
  title: string;
  description?: string;
  delegatedTo: string; // Name of the person
  category?: string;
  expectedDurationMinutes?: number;
  userId: string;
}

export interface DelegatedTaskUpdate {
  status: 'assigned' | 'partial' | 'completed';
  progressPercent?: number;
  note?: string;
}

/**
 * Create a new delegated task
 */
export async function createDelegatedTask(input: DelegatedTaskInput): Promise<Task> {
  const tasksCollection = database.get<Task>('tasks');

  const task = await database.write(async () => {
    return await tasksCollection.create((record) => {
      record.title = input.title;
      record.description = input.description || '';
      record.type = 'custom';
      record.category = input.category || 'delegated';
      record.expectedDurationMinutes = input.expectedDurationMinutes || 0;
      record.userId = input.userId;
      record.isDelegated = true;
      record.delegatedTo = input.delegatedTo;
      record.delegatedStatus = 'assigned';
      record.completionPercent = 0;
    });
  });

  console.log('[DelegationService] Task delegated:', input.title, 'to', input.delegatedTo);
  return task;
}

/**
 * Update delegated task status
 */
export async function updateDelegatedTaskStatus(
  taskId: string,
  update: DelegatedTaskUpdate,
  userId: string
): Promise<Task> {
  const tasksCollection = database.get<Task>('tasks');
  const task = await tasksCollection.find(taskId);

  await database.write(async () => {
    await task.update((record) => {
      record.delegatedStatus = update.status;
      if (update.progressPercent !== undefined) {
        record.completionPercent = Math.min(100, Math.max(0, update.progressPercent));
      }
      if (update.status === 'completed') {
        record.isCompleted = true;
        record.completionPercent = 100;
      }
    });
  });

  if (update.status === 'completed') {
    await emitEvent({
      eventType: EventTypes.DELEGATED_TASK_COMPLETED,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        delegatedTo: task.delegatedTo,
        note: update.note,
      },
      userId,
    });
  } else {
    await emitEvent({
      eventType: EventTypes.DELEGATED_TASK_UPDATED,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        delegatedTo: task.delegatedTo,
        newStatus: update.status,
        progressPercent: update.progressPercent,
        note: update.note,
      },
      userId,
    });
  }

  console.log('[DelegationService] Task status updated:', task.title, '→', update.status);
  return task;
}

/**
 * Get all delegated tasks
 */
export async function getDelegatedTasks(userId: string): Promise<Task[]> {
  const tasksCollection = database.get<Task>('tasks');
  return await tasksCollection
    .query(Q.where('user_id', userId), Q.where('is_delegated', true), Q.where('deleted_at', null))
    .fetch();
}

/**
 * Get delegated tasks by status
 */
export async function getDelegatedTasksByStatus(
  userId: string,
  status: 'assigned' | 'partial' | 'completed'
): Promise<Task[]> {
  const tasksCollection = database.get<Task>('tasks');
  return await tasksCollection
    .query(
      Q.where('user_id', userId),
      Q.where('is_delegated', true),
      Q.where('delegated_status', status),
      Q.where('deleted_at', null)
    )
    .fetch();
}

/**
 * Delete a delegated task
 */
export async function deleteDelegatedTask(taskId: string): Promise<void> {
  const tasksCollection = database.get<Task>('tasks');
  const task = await tasksCollection.find(taskId);

  await database.write(async () => {
    await task.update((record) => {
      record.deletedAt = Date.now();
    });
  });

  console.log('[DelegationService] Task deleted:', task.title);
}

export default {
  create: createDelegatedTask,
  updateStatus: updateDelegatedTaskStatus,
  getAll: getDelegatedTasks,
  getByStatus: getDelegatedTasksByStatus,
  delete: deleteDelegatedTask,
};
